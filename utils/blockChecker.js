class blockChecker {
  constructor(bot) {
    this.bot = bot;
  }

  async isDirt(pos, mcData) {
    const block = await this.bot.blockAt(pos);

    if (!block) {
      console.log(`Block at ${pos} is null`);
      return false;
    }

    // Check if the block is dirt or grass block
    const blockType = block.type;
    const dirtBlockId = mcData.blocksByName.dirt.id;
    const grassBlockId = mcData.blocksByName.grass_block.id;

    if (blockType === dirtBlockId || blockType === grassBlockId) {
    //  console.log(`Block at ${pos} is dirt or grass`);
      return true;
    } else {
     // console.log(`Block at ${pos} is not dirt or grass, it's ${blockType}`);
      return false;
    }
  }

  async isFarmland(pos, mcData) {
    const block = await this.bot.blockAt(pos);

    if (!block) {
      console.log(`Block at ${pos} is null`);
      return false;
    }

    // Check if the block is farmland
    const farmlandBlockId = mcData.blocksByName.farmland.id;

    if (block.type === farmlandBlockId) {
    //  console.log(`Block at ${pos} is farmland`);
      return true;
    } else {
     // console.log(`Block at ${pos} is not farmland, it's ${block.type}`);
      return false;
    }
  }

  async isWheat(pos, mcData) {
    const block = await this.bot.blockAt(pos);

    if (!block) {
      console.log(`Block at ${pos} is null`);
      return false;
    }

    // Check if the block is wheat
    const wheatBlockId = mcData.blocksByName.wheat.id;

    if (block.type === wheatBlockId) {
  //    console.log(`Block at ${pos} is wheat`);
      return true;
    } else {
    //  console.log(`Block at ${pos} is not wheat, it's ${block.type}`);
      return false;
    }
  }
}

module.exports = blockChecker;
