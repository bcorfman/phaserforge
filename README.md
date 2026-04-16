# PhaserActions Studio

A browser-based editor shell using Phaser 3 as the runtime.

<img src="res/images/mainwindow.png?raw=true" style="width: 800px"/>

Planned architecture:

- editor UI in React
- Phaser runtime embedded in the app
- declarative scene/behavior model
- compiler from model -> runtime
- minimal PhaserActions runtime separate from Phaser scene code

Initial focus:
- formation demo
- composable actions
- group behavior
- live parameter editing


## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Launch a development web server |
| `npm run build` | Create a production build in the `dist` folder |
| `npm run dev-nolog` | Launch a development web server without sending anonymous data (see "About log.js" below) |
| `npm run build-nolog` | Create a production build in the `dist` folder without sending anonymous data (see "About log.js" below) |

## Writing Code

After cloning the repo, run `npm install` from your project directory. Then, you can start the local development server by running `npm run dev`.

The local development server runs on `http://localhost:8080` by default. Please see the Vite documentation if you wish to change this, or add SSL support.

Once the server is running you can edit any of the files in the `src` folder. Vite will automatically recompile your code and then reload the browser.
