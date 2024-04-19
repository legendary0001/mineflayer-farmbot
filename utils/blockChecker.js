class BlockChecker {
  constructor(bot) {
    this.bot = bot;
  }

  async checkBlockType(pos, mcData, blockName) {
    const block = await this.bot.blockAt(pos);

    if (!block) {
      throw new Error(`Block at ${pos} is null`);
    }

    const blockId = mcData.blocksByName[blockName].id;

    return block.type === blockId;
  }

  async isDirt(pos, mcData) {
    return this.checkBlockType(pos, mcData, 'dirt') || this.checkBlockType(pos, mcData, 'grass_block');
  }

  async isFarmland(pos, mcData) {
    return this.checkBlockType(pos, mcData, 'farmland');
  }

  async isWheat(pos, mcData) {
    return this.checkBlockType(pos, mcData, 'wheat');
  }
}

module.exports = BlockChecker;
