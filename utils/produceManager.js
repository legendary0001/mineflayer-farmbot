const { GoalGetToBlock } = require("mineflayer-pathfinder").goals;
const { Vec3 } = require("vec3");
class ProduceManager {
  constructor(bot) {
    this.bot = bot;
    this.allowedItems = ["wheat", "hoe"]; // Items to be retained
    this.dustbinCoords = null;
    this.isNavigating = false;
  }
  async cleanInventoryIfNeeded(dustbinCoords, startPos, endPos, mcData) {
    this.dustbinCoords = dustbinCoords;
    this.startPos = startPos;
    this.endPos = endPos;
    const emptySlots = this.bot.inventory.emptySlotCount();
    const minEmptySlots = 10; // Minimum number of empty slots to trigger cleaning

    if (emptySlots < minEmptySlots) {
      console.log(
        `Inventory space is low (${emptySlots} empty slots). Cleaning inventory...`
      );
      await this.cleanInventory(mcData);
    } else {
      //  console.log(    `Inventory space is sufficient (${emptySlots} empty slots). No cleaning needed.`  );
    }
  }

  async cleanInventory(mcData) {
    const items = this.bot.inventory.items();
    const itemsToToss = items.filter((item) => !this.shouldKeepItem(item));
    const seedsCount = items.filter(
      (item) => item.name === "wheat_seeds"
    ).length;
    const requiredseeds = this.roughCleanExtraseeds(this.startPos, this.endPos);
    const seedsToToss = seedsCount - requiredseeds;

    if (itemsToToss.length === 0 && seedsToToss <= 0) {
      console.log("No items to toss.");
      return;
    }

    if (!this.isNavigating) {
      this.isNavigating = true;
      await this.navigateToDustbin();
    }

    for (const item of itemsToToss) {
      await this.bot.tossStack(item);
    }
    if (seedsToToss > 0) {
      await this.bot.toss(mcData.itemsByName.wheat_seeds.id, null, seedsToToss);
    }
    await this.goback();
    this.dustbinCoords = null;
  }
  roughCleanExtraseeds(startPos, endPos) {
    const length = Math.abs(endPos[0] - startPos[0]);

    const width = Math.abs(endPos[2] - startPos[2]);

    // area
    const requiredseeds = length * width;
    console.log("roughrequiredseeds", requiredseeds);
    return requiredseeds;
  }
  shouldKeepItem(item) {
    // Check if the item's name includes any of the allowed items
    return this.allowedItems.some((allowedItem) =>
      item.name.includes(allowedItem)
    );
  }

  async navigateToDustbin(dustbinCoords) {
    if (!this.dustbinCoords) {
      if (!dustbinCoords) {
        console.log("Dustbin coordinates not set.");
        return;
      } else {
        this.dustbinCoords = dustbinCoords;
      }
    }

    const goal = new GoalGetToBlock(
      this.dustbinCoords[0],
      this.dustbinCoords[1],
      this.dustbinCoords[2]
      // 1
    );
    this.bot.pathfinder.setGoal(goal);

    await new Promise((resolve) => {
      this.bot.once("goal_reached", async () => {
        this.isNavigating = false;

        console.log("Reached dustbin location.");
        await this.bot.lookAt(
          new Vec3(
            this.dustbinCoords[0],
            this.dustbinCoords[1],
            this.dustbinCoords[2]
          )
        );
        resolve();
        return;
      });
    });
  }
  async depositWheatIfNeeded(chestSearchRadius, mcData) {
    const chest = await this.findNearestChest(chestSearchRadius, mcData);
    //console.log("chest, ", chest);
    if (!chest) {
      console.log("No chest found in the area.");
      return { success: false, reason: "nochest" };
    }
    if (chest) {
      const wheatItems = this.bot.inventory
        .items()
        .filter((item) => item.name === "wheat");
      if (wheatItems.length > 0) {
        // Check if chest has space for wheat
        const spaceForWheat = await this.calculateSpaceInChest(
          chest,
          "wheat",
          mcData
        );
        if (typeof spaceForWheat === "string") {
          console.log(`Failed to calculate space in chest: ${spaceForWheat}`);
          return { success: false, reason: spaceForWheat };
        }
        if (spaceForWheat > 0) {
          const chestInventory = await this.bot.openContainer(chest);
          if (!chestInventory) {
            console.log("Failed to open chest inventory.");
            return { success: false, reason: "chestopenfailed" };
          }

          let depositedCount = 0;
          for (const item of wheatItems) {
            if (depositedCount >= spaceForWheat) {
              console.log("Chest is full. Stopping wheat deposit.");
              break;
            } else {
              await chestInventory.deposit(
                mcData.itemsByName.wheat.id,
                null,
                item.count
              );
              depositedCount += item.count;
            }
          }
          //   console.log("wheatItems", wheatItems);
          await chestInventory.close();

          return {
            success: true,
            depositedCount: depositedCount,
          };
        } else {
          console.log("Chest is full. Skipping wheat deposit.");
          return {
            success: false,
            reason: "chestfull",
          };
        }
      } else {
        console.log("No wheat in inventory to deposit.");
        return {
          success: false,
          reason: "nowheat",
        };
      }
    }
  }

  async findNearestChest(radius, mcData) {
    const startVec = new Vec3(
      this.startPos[0],
      this.startPos[1],
      this.startPos[2]
    );
    console.log("startPos", this.startPos);
    const chestId = mcData.blocksByName.chest.id;

    const chests = this.bot.findBlocks({
      matching: (block) => block.type === chestId,
      point: startVec,
      maxDistance: radius,
      count: 1,
    });
    //console.log("chests", chests);
    if (chests.length === 0) {
      console.log("No chest found in the area.");
      return null;
    }
    const chestblock = this.bot.blockAt(chests[0]);

    //   console.log("chestblock", chestblock);
    if (!chestblock) {
      console.log("Chest block is not available.");
      return null;
    }
    this.bot.pathfinder.setGoal(
      new GoalGetToBlock(
        chestblock.position.x,
        chestblock.position.y,
        chestblock.position.z
      )
    );
    await new Promise((resolve) => {
      this.bot.once("goal_reached", async () => {
        this.isNavigating = false;
        console.log("Reached chest location.");
        resolve();
        return;
      });
    });
    return chestblock;
  }
  async accurateCleanExtraseeds(requiredseeds, mcData) {
    const seedsCount = this.bot.inventory.count(
      mcData.itemsByName.wheat_seeds.id
    );
    console.log("seedsCount", seedsCount);
    if (seedsCount > requiredseeds) {
      const seedsToToss = seedsCount - requiredseeds;
      /*
      const seeds = this.bot.inventory
        .items()
        .filter((item) => item.name === "wheat_seeds");
        */
      await this.navigateToDustbin();
      await this.bot.toss(mcData.itemsByName.wheat_seeds.id, null, seedsToToss);
      await this.goback();

      console.log(`Tossed ${seedsToToss} extra seeds.`);
    }
  }
  async goback() {
    this.bot.pathfinder.setGoal(
      new GoalGetToBlock(this.startPos[0], this.startPos[1], this.startPos[2])
    );
    await new Promise((resolve) => {
      this.bot.once("goal_reached", async () => {
        this.isNavigating = false;
        console.log("Reached start location.");
        resolve();
        return;
      });
    });
  }
  setcords(startcords, dustbinCoords) {
    this.startPos = startcords;
    this.dustbinCoords = dustbinCoords;
  }
  async calculateSpaceInChest(chest /* itemType, mcData*/) {
    try {
      if (!chest) {
        console.log("Chest is not available.");
        return "chestnotavailable";
      }

      // Check if the block is actually a chest
      if (chest.name !== "chest") {
        console.log("The block is not a chest.");
        return "notachest";
      }

      // Open the chest to access its inventory
      const chestInventory = await this.bot.openContainer(chest);

      if (!chestInventory) {
        console.log("Failed to open chest inventory.");
        return "chestopenfailed";
      }
      const containerSlots = chestInventory.containerItems();
      //console.log("containerSlots", containerSlots);
      // Calculate available space for wheat items (assuming wheat slots are predefined)
      const wheatSlots = containerSlots.filter(
        (slot) => slot && slot.name === "wheat"
      );
      const maxSlots =
        chestInventory.type === "minecraft:generic_9x6" ? 54 : 27;
      const maxStackSize = 64; // Assuming max stack size for wheat is 64
      const emptyContainerSlots =
        (maxSlots - containerSlots.length) * maxStackSize;

      let availableWheatSlots = 0;
      for (const slot of wheatSlots) {
        if (slot) {
          const remainingSpace = maxStackSize - slot.count;
          if (remainingSpace > 0) {
            availableWheatSlots += remainingSpace;
          }
        }
      }
      await chestInventory.close();
      console.log("emptyContainerSlots", emptyContainerSlots);
      console.log("availableWheatSlots", availableWheatSlots);
      const totalSpace = emptyContainerSlots + availableWheatSlots;
      console.log("totalSpace", totalSpace);
      return totalSpace;

      // Close the chest inventory after processing
    } catch (error) {
      console.log("Error in calculateSpaceInChest: ", error);
      return " unexptected error";
    }
  }
  /*
  async collectWheat(mcData) {
  const wheatentity = mcData.blocksByName.wheat.id;
  }
  */
}

module.exports = ProduceManager;
