class itemHandler {
  constructor(bot) {
    this.bot = bot;
  }
  async equipItem(name) {
    const item = this.bot.inventory.items().find((item) => item.name === name);
    if (!item) {
      this.bot.chat(`I don't have ${name}`);
      return false;
    }

    if (this.isItemEquipped(item)) {
      // this.bot.chat(`${name} is already equipped`);
     // console.log(`${name} is already equipped`);
      return true;
    }

    try {
      this.bot.equip(item, "hand", (err) => {
        if (err) {
          this.bot.chat(`Unable to equip ${name}: ${err.message}`);
          console.error(`Equip ${name} error:`, err);
          return false; // Reject promise if there's an error equipping the item
        } else {
        //  this.bot.chat(`Equipped ${name}`);
          return true;
          // Resolve promise with true if item is successfully equipped
        }
      });
      return true; // Return true after successfully equipping the item
    } catch (error) {
      console.error(`Equip ${name} error:`, error);
      return false; // Return false if an error occurs during the equipment process
    }
  }

  unequipItem(destination) {
    this.bot.unequip(destination, (err) => {
      if (err) {
        this.bot.chat(`cannot unequip: ${err.message}`);
      } else {
        this.bot.chat("unequipped");
      }
    });
  }

  hasItemByName(name) {
    return this.bot.inventory.items().filter((item) => item.name === name)[0]
      ? true
      : false;
  }

  async equipHoe() {
    //console.log("equipHoe");
    //console.log("finding hoe");

    const hoes = this.bot.inventory
      .items()
      .filter((item) => item.name.includes("hoe"))[0];
    if (!hoes) {
      console.log("No hoe found");
      return false;
    }
    if (this.isItemEquipped(hoes)) {
      console.log("Hoe is already equipped");
      return true; // Resolve immediately if hoe is already equipped
    }
    try {
      this.bot.equip(hoes, "hand", (err) => {
        if (err) {
          this.bot.chat(`Unable to equip hoe: ${err.message}`);
          console.log(err);
          return false;
        } else {
          this.bot.chat("Equipped hoe");
          return true;
        }
      });
      return true;
    } catch (error) {
      console.error("Equip hoe error:", error);
      return false;
    }
  }
  isItemEquipped(item) {
    const handItem =
      this.bot.inventory.slots[this.bot.getEquipmentDestSlot("hand")];
    return handItem && handItem.name === item.name;
  }
}
module.exports = itemHandler;
