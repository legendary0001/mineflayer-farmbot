const mineflayer = require("mineflayer");
const blockFinderPlugin = require("mineflayer-blockfinder")(mineflayer);
const minecraftData = require("minecraft-data");
const fs = require("fs");
const { Vec3 } = require("vec3");
const { pathfinder, Movements } = require("mineflayer-pathfinder");
const { GoalNear, GoalGetToBlock } = require("mineflayer-pathfinder").goals;
const blockCheckerInit = require("./utils/blockChecker");
const itemHandlerInit = require("./utils/item");
const produceManagerInit = require("./utils/produceManager");
require("dotenv").config();
const config = process.env;

// Initialize variables
let bot;
let reconnectInterval;
let farmingInterval;
let mcData;
let farmingInProgress = false; // Flag to track whether farming is in progress
let isConnected = false;
// Load and initialize data
try {
  if (!fs.existsSync("data.json")) {
    fs.writeFileSync("data.json", JSON.stringify({}));
  }
} catch (err) {
  console.error(err);
}

// Create bot function
function createBot() {
  bot = mineflayer.createBot({
    host: config.host,
    port: Number(config.port),
    auth: config.auth,
    username: config.username || "",
    password: config.password || "",
    version: config.version || null,
  });

  // Initialize utility instances
  const itemHandler = new itemHandlerInit(bot);
  const blockChecker = new blockCheckerInit(bot);
  const produceManager = new produceManagerInit(bot);

  // Load plugins
  bot.loadPlugin(blockFinderPlugin);
  bot.loadPlugin(pathfinder);

  // Bot event listeners
  bot.on("chat", async (username, message) => {
    console.log(`${username} said: ${message}`);

    if (username === bot.username) return;
    message = message.toLowerCase();
    if (message.includes("!help")) {
      bot.chat("commands: \n!set , !enable , !disable");
    }
    if (message.includes("!exit")) {
      bot.chat("exiting");
      bot.quit();
      process.exit(0);
    }
    if (message.includes("!enable")) {
      const data = JSON.parse(fs.readFileSync("data.json"));

      if (!data) {
        bot.chat(
          "set farm by !set startcords endcords dustbincords\neg: !set 1,2,3 4,5,6 7,8,9"
        );
      } else {
        if (!data.start || !data.end || !data.dustbin) {
          bot.chat(
            "set farm by !set startcords endcords dustbincords\neg: !set 1,2,3 4,5,6 7,8,9  "
          );
          return;
        }
        // enable logic
        data.enable = true;
        fs.writeFileSync("data.json", JSON.stringify(data));
        bot.chat("enabled automatic farming");
      }
    }
    if (message.includes("!disable")) {
      bot.chat("disabled automatic farming");
      const data = JSON.parse(fs.readFileSync("data.json"));
      // disable logic
      data.enable = false;
      fs.writeFileSync("data.json", JSON.stringify(data));
    }
    if (message.includes("!set")) {
      // split the message to get the coordinates
      let cords = message.split(" ");
      let start = cords[1]?.split(",");
      let end = cords[2]?.split(",");
      let dustbin = cords[3]?.split(",");

      if (
        !start ||
        !end ||
        !dustbin ||
        start.length !== 3 ||
        end.length !== 3 ||
        dustbin.length !== 3
      ) {
        bot.chat(
          "Invalid coordinates format. Use '!set startcords endcords dustbincords', e.g., '!set 1,2,3 4,5,6 7,8,9'"
        );
        return;
      }

      // start[1] = String(Number(start[1]) - 1);
      // end[1] = String(Number(end[1]) - 1);
      // y level minecraft cordinates displayed in f3 is 1 more than y coordinate of block
      dustbin[1] = String(Number(dustbin[1]) - 1);

      const startVec = new Vec3(...start.map(Number));
      const endVec = new Vec3(...end.map(Number));

      const isValidBlockType = async (pos, mcData) => {
        const block = await bot.blockAt(pos);
        if (!block) return false;

        const blockType = block.type;
        const validBlockIds = [
          mcData.blocksByName.dirt.id,
          mcData.blocksByName.farmland.id,
          mcData.blocksByName.grass_block.id,
          mcData.blocksByName.water.id,
        ];

        return validBlockIds.includes(blockType);
      };

      // Check all specified coordinates
      const allCoords = [startVec, endVec];
      for (const pos of allCoords) {
        if (!(await isValidBlockType(pos, mcData))) {
          bot.chat(
            "Invalid block type detected in specified coordinates. Only dirt, farmland, grass, or water blocks are allowed."
          );
          return;
        }
      }

      // Save valid data to JSON file
      fs.writeFileSync(
        "data.json",
        JSON.stringify({ start, end, dustbin, enable: true })
      );
      bot.chat("Farm area set successfully.");
    }
  });
  // Start the farming logic once the bot is logged in
  // and clear the reconnect interval if it is set
  bot.once("login", async () => {
    console.log("Bot logged in ");
    isConnected = true;
    clearInterval(reconnectInterval);
    mcData = minecraftData(bot.version);
    bot.chat("farmer bot made by jagrit at your service!");

    farmingInterval = setInterval(async () => {
      if (!isConnected) {
        console.log("Bot is not connected. Stopping farming.");
        farmingInProgress = false; // Reset the farming flag
        return; // Exit the interval if bot is not connected
      }
      if (!farmingInProgress) {
        farmingInProgress = true; // Set the flag to indicate farming is in progress
        console.log("Starting farming...");
        await startFarming(mcData);
        console.log("Farming complete.");
        farmingInProgress = false; // Reset the flag once farming is complete
      } else {
        console.log("Farming already in progress, skipping...");
      }
    }, 10000);
  });
  bot.on("kicked", (reason) => {
    console.log("Kicked for", reason);
    isConnected = false;
    farmingInProgress = false;
    clearInterval(farmingInterval);
    reconnect();
  });
  bot.on("end", () => {
    console.log("Bot disconnected");
    isConnected = false;
    farmingInProgress = false;
    clearInterval(farmingInterval);
    reconnect();
  });
  bot.on("error", (err) => {
    console.log("Error occurred:", err.message);
    if (err.code.includes("ECONNRESET")) {
      console.log("Connection reset by peer");
      isConnected = false;
      farmingInProgress = false;
      clearInterval(farmingInterval);
      reconnect();
    }
  });

  // Main farming logic
  async function startFarming() {
    try {
      bot.once("end", () => {
        console.log("Bot disconnected");
        isConnected = false;
        farmingInProgress = false;
        return;
      });
      const data = JSON.parse(fs.readFileSync("data.json"));
      if (!data || !data.enable || !data.start || !data.end || !data.dustbin) {
        return;
      }
      produceManager.setcords(data.start.map(Number), data.dustbin.map(Number));
      const chest = await produceManager.findNearestChest(16, mcData);
      //console.log("Chest found", chest);
      //const wheatItems = bot.inventory.items() .filter((item) => item.name === "wheat");

      if (chest) {
        const space = await produceManager.calculateSpaceInChest(
          chest,
          "wheat",
          mcData
        );
        if (typeof space === "string") {
          console.log(`Failed to calculate space in chest: ${space}`);
          return;
        }
        if (space > 0) {
          data.tempDisabled = false;
          fs.writeFileSync("data.json", JSON.stringify(data));
          if (data.tempDisabled) {
            bot.chat("Farming re-enabled, chest space available.");
          }
        } else {
          bot.chat("Chest found but no space available,  farming disabled.");
          data.tempDisabled = true;
          fs.writeFileSync("data.json", JSON.stringify(data));
        }
      }
      if (data.tempDisabled) {
        console.log("Farming is temporarily disabled due to full chest.");
        return;
      }
      const startCoords = data.start.map(Number); // Convert coordinates to numbers
      const endCoords = data.end.map(Number); // Convert coordinates to numbers

      console.log("Farming function called");

      const startX = Math.min(startCoords[0], endCoords[0]);
      const endX = Math.max(startCoords[0], endCoords[0]);
      const startY = startCoords[1];
      const startZ = Math.min(startCoords[2], endCoords[2]);
      const endZ = Math.max(startCoords[2], endCoords[2]);
      let requiredseedscount = 0;

      for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
          if (!isConnected) {
            console.log("Bot disconnected. not starting farming.");
            return;
          }
          await produceManager.cleanInventoryIfNeeded(
            data.dustbin.map(Number),
            data.start.map(Number),
            data.end.map(Number),
            mcData
          );
          // console.log("Checking block at", x, startY, z);
          try {
            if (await blockChecker.isDirt(new Vec3(x, startY, z), mcData)) {
              requiredseedscount++;
              const block = await bot.blockAt(new Vec3(x, startY, z));
              const aboveBlock = await bot.blockAt(new Vec3(x, startY + 1, z));

              if (!block) {
                console.log(`Block at ${x}, ${startY}, ${z} is not found`);
                continue; // Skip to next iteration if block is not found
              }

              console.log("Equipping hoe to till land at", x, startY, z);

              // Equip hoe (assuming this function works as expected)
              const equipped = await itemHandler.equipHoe();

              // Ensure the block is defined and has a position
              if (block && block.position) {
                // Calculate target position just above the block
                const targetPosition = block.position.offset(0.5, 1, 0.5); // Adjusted position just above the block

                // Move towards the target position
                if (equipped) {
                  if (bot.entity.position !== targetPosition) {
                    const goal = new GoalNear(
                      targetPosition.x,
                      targetPosition.y,
                      targetPosition.z,
                      0.5
                    ); // Set a tolerance of 0.5 block radius
                    bot.pathfinder.setMovements(new Movements(bot, mcData));
                    bot.pathfinder.setGoal(goal);
                    await new Promise((resolve) => {
                      bot.once("goal_reached", async () => {
                        bot.pathfinder.setGoal(null); // Clear the goal once reached
                        console.log(
                          "unexpected goal (if not null)",
                          bot.pathfinder.goal
                        );
                        console.log(
                          `Bot reached position above block at ${x}, ${startY}, ${z}`
                        );
                        if (
                          aboveBlock &&
                          aboveBlock.type !== mcData.blocksByName.air.id
                        ) {
                          await bot.dig(aboveBlock);
                          await itemHandler.equipHoe();
                        }
                        // Look at the block position
                        await bot.lookAt(block.position);
                        // If equipped with hoe, activate the block (till the land)
                        console.log("equipped", equipped);
                        if (equipped) {
                          console.log("activating block");
                          await bot.activateBlock(block);
                          console.log("activated block");
                        }

                        resolve(); // Resolve the promise once the action is complete
                      });
                    });
                  } else {
                    console.log("already at target position");
                    if (
                      aboveBlock &&
                      aboveBlock.type !== mcData.blocksByName.air.id
                    ) {
                      await bot.dig(aboveBlock);
                    }
                    await bot.lookAt(block.position);

                    // If equipped with hoe, activate the block (till the land)
                    if (equipped) {
                      console.log("activating block");
                      await bot.activateBlock(block);
                      console.log("activated block");
                    }
                  }
                }
                // Wait for bot to reach the target position
              } else {
                console.error(
                  `Block or block position is undefined at ${x}, ${startY}, ${z}`
                );
              }
            } else if (
              await blockChecker.isFarmland(new Vec3(x, startY, z), mcData)
            ) {
              requiredseedscount++;
              const block = await bot.blockAt(new Vec3(x, startY, z));

              if (!block) {
                console.log(`Block at ${x}, ${startY + 1}, ${z} is not found`);
                continue; // Skip to next iteration if block is not found
              }
              if (
                await blockChecker.isWheat(new Vec3(x, startY + 1, z), mcData)
              ) {
                const wheatBlock = await bot.blockAt(
                  new Vec3(x, startY + 1, z)
                );
                const wheatAge = wheatBlock.metadata;
                //console.log("Wheat age", wheatAge);
                if (wheatAge === 7) {
                  console.log("Harvesting wheat at", x, startY + 1, z);

                  if (block && block.position) {
                    // Calculate target position just above the block
                    const targetPosition = block.position.offset(0.5, 1, 0.5); // Adjusted position just above the block
                    const currentPos = bot.entity.position;

                    // Move towards the target position
                    if (currentPos !== targetPosition) {
                      const goal = new GoalGetToBlock(
                        targetPosition.x,
                        targetPosition.y,
                        targetPosition.z
                        // 0.5
                      ); // Set a tolerance of 0.5 block radius
                      bot.pathfinder.setMovements(new Movements(bot));
                      bot.pathfinder.setGoal(goal);
                    } else {
                      bot.emit("goal_reached");
                    }
                    // Wait for bot to reach the target position
                    await new Promise((resolve) => {
                      bot.once("goal_reached", async () => {
                        bot.pathfinder.setGoal(null); // Clear the goal once reached
                        console.log(
                          "unexpected goal (if not null)",
                          bot.pathfinder.goal
                        );

                        console.log(
                          `Bot reached position above block at ${x}, ${
                            startY + 1
                          }, ${z}`
                        );
                        // Look at the block position
                        bot.lookAt(block.position);
                        // If equipped with seeds, activate the block (plant the seeds)
                        await bot.dig(wheatBlock);
                        // await produceManager.collectWheat();
                        // Delay for a short period to allow items to drop
                        await delay(1000);

                        const hasSeeds =
                          itemHandler.hasItemByName("wheat_seeds");
                        console.log("hasSeeds", hasSeeds);
                        if (hasSeeds) {
                          console.log(
                            "Equipping seeds to plant at",
                            x,
                            startY + 1,
                            z
                          );
                          const seedsEquipped = await itemHandler.equipItem(
                            "wheat_seeds"
                          );
                          if (seedsEquipped) {
                            console.log("activating block");
                            await bot.activateBlock(block);
                            console.log("activated block");
                          }
                        } else {
                          console.log("No seeds found in inventory");
                        }
                        resolve(); // Resolve the promise once the action is complete
                      });
                    });
                  }
                }
              } else {
                const hasSeeds = itemHandler.hasItemByName("wheat_seeds");
                // console.log("hasSeeds", hasSeeds);

                if (hasSeeds) {
                  console.log("Equipping seeds to plant at", x, startY + 1, z);
                  const seedsEquipped = await itemHandler.equipItem(
                    "wheat_seeds"
                  );

                  // Ensure the block is defined and has a position
                  if (block && block.position) {
                    // Calculate target position just above the block
                    // const targetPosition = block.position.offset(0.5, 1, 0.5); // Adjusted position just above the block

                    // Move towards the target position
                    console.log(
                      "blockPosition ",
                      block.position,
                      "\n",
                      "blockPosition rounded ",
                      block.position.rounded()
                    );
                    const currentPos = bot.entity.position;
                    console.log(
                      "currentPos ",
                      currentPos,
                      "\n",
                      "currentPos rounded",
                      currentPos.rounded()
                    );
                    if (
                      !currentPos.floored().equals(block.position.rounded())
                    ) {
                      const goal = new GoalGetToBlock(
                        block.position.x,
                        block.position.y + 1,
                        block.position.z
                        //   0.8
                      ); // Set a tolerance of 0.5 block radius
                      const MovementsAlowed = new Movements(bot);
                      // MovementsAlowed.allowSprinting = false;
                      bot.pathfinder.setMovements(MovementsAlowed);
                      bot.pathfinder.goto(goal);
                      console.log("moving to target position");
                      await new Promise((resolve) => {
                        bot.once("goal_reached", async () => {
                          //  bot.pathfinder.setGoal(null); // Clear the goal once reached
                          console.log(
                            "unexpected goal (if not null)",
                            bot.pathfinder.goal
                          );

                          console.log("bot is on targetPosition");
                          // Look at the block position
                          await bot.lookAt(block.position);
                          // If equipped with seeds, activate the block (plant the seeds)
                          console.log("seedsEquipped", seedsEquipped);
                          if (seedsEquipped) {
                            console.log("activating block");
                            await bot.activateBlock(block);
                            console.log("activated block");
                          }
                          resolve(); // Resolve the promise once the action is complete
                        });
                      });
                    } else {
                      console.log("already at target position");
                      await bot.lookAt(block.position);
                      // If equipped with seeds, activate the block (plant the seeds)
                      if (seedsEquipped) {
                        await bot.activateBlock(block);
                      }
                    }
                    // Wait for bot to reach the target position
                  } else {
                    console.error(
                      `Block or block position is undefined at ${x}, ${
                        startY + 1
                      }, ${z}`
                    );
                  }
                } else {
                  //console.log("No seeds found in inventory");
                }
              }
            }
          } catch (error) {
            console.error(
              `Error while processing block at ${x}, ${startY}, ${z}:`,
              error
            );
            // Handle any errors that occur during block processing
          }
        }
      }
      if (!isConnected) {
        console.log("Bot disconnected. Stopping farming.");
        return;
      }
      console.log("requiredseedscount", requiredseedscount);
      await produceManager.accurateCleanExtraseeds(requiredseedscount, mcData);
      if (!isConnected) {
        console.log("Bot disconnected. Stopping farming.");
        return;
      }
      const wheatDeposit = await produceManager.depositWheatIfNeeded(
        16,
        mcData
      );
      if (wheatDeposit.success) {
        console.log(
          `Deposited ${wheatDeposit.depositedCount} wheat into chest.`
        );
      } else {
        console.log(`Failed to deposit wheat: ${wheatDeposit.reason}`);
        if (wheatDeposit.reason === "chestfull") {
          console.log("Disabling farming temporarily due to full chest");
          data.tempDisabled = true;
          fs.writeFileSync("data.json", JSON.stringify(data));
        } else if (wheatDeposit.reason === "nochest") {
          bot.chat(
            "No chest found near startCoords you gave during set command."
          );
        } else if (
          wheatDeposit.reason === "notachest" ||
          wheatDeposit.reason === "chestnotavailable"
        ) {
          bot.chat("No chest found nearby to deposit wheat.");
        } else if (wheatDeposit.reason === "chestopenfailed") {
          bot.chat("Failed to open chest to deposit wheat.");
        } else if (wheatDeposit.reason === "nowheat") {
          // bot.chat("No wheat in inventory to deposit.");
        } else {
          bot.chat(`Failed to deposit wheat: ${wheatDeposit.reason}`);
        }
      }
    } catch (error) {
      console.error("Error in startFarming", error);
      farmingInProgress = false;
    }
  }
}
// Reconnect bot function
function reconnect() {
  // return if bot is already connected
  if (bot && bot.connected) {
    console.log("Bot already connected.");
    return;
  }
  // set reconnect interval to try to reconnect bot every 20 seconds
  // if reconnect interval is not set
  if (!reconnectInterval) {
    reconnectInterval = setInterval(() => {
      console.log("Reconnecting bot...");

      createBot();
    }, 20000);
  }
}
// Delay function
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
createBot();
// for nodejs version higher than 15
// handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
  // process.exit(1);
});
// handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  // process.exit(1);
});
