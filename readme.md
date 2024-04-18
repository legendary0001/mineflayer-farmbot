 # Minecraft Wheat Farming Bot

This project is a Minecraft bot that automates wheat farming tasks. It uses the Mineflayer library to connect to a Minecraft server and perform actions like tilling land, planting seeds, and harvesting crops. The bot also manages its inventory, checks for valid block types, and handles disconnections and reconnections.
I made this because wheat farming is only semi automatic through redstone

## Features

-  farming: The bot can till land, plant seeds, and harvest crops.
- Inventory management: The bot manages its inventory, equipping tools and seeds as needed, and depositing harvested crops in a chest.
- Block type checking: The bot checks the type of each block in the specified farming area and performs the appropriate action.
- Disconnection handling: The bot attempts to reconnect every 20 seconds if it gets disconnected.
- Persistence: The bot reads and writes to a `data.json` file to persist its state across sessions. This includes the farming area coordinates and whether automatic farming is enabled.
- Chat commands: The bot listens for chat commands and responds to commands like `!help`, `!exit`, `!enable`, `!disable`, and `!set`. These commands allow users to interact with the bot and control its behavior.

## Installation

1. Clone this repository.
2. Run `npm install` to install the required dependencies.
3. Create a `.env` file in the root directory and set the following environment variables:
    - `host`: The IP address of the Minecraft server.
    - `port`: The port number of the Minecraft server.
    - `auth`: The authentication method for the Minecraft server.
    - `username`: The username of the Minecraft account.
    - `password`: The password of the Minecraft account.

## Usage

1. Run `node index.js` to start the bot.
2. In Minecraft, use the chat commands to interact with the bot:
    - `!help`: Displays a list of available commands.
    - `!exit`: Quits the bot.
    - `!enable`: Enables automatic farming.
    - `!disable`: Disables automatic farming.
    - `!set`: Sets the farming area. The command format is `!set startcords endcords dustbincords`, e.g., `!set 1,2,3 4,5,6 7,8,9`.
3. In minecraft, use the !set command
## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License.