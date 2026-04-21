# PhaserActions Studio

## Intent
A browser-based visual editor that pairs with my PhaserActions library to orchestrate 2D game development. Instead of writing scattered, spaghetti logic in a traditional Phaser update loop, users drag and drop sprites on a canvas and assign them structured actions that run based on meaningful ame conditions. The tool allows developers to visually construct scenes, layer behaviors, and instantly toggle into play mode to test inputs and collisions, ultimately exporting a JSON scene configuration that can be modified without recompiling code.

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

## YAML and Preview

`Export YAML` always serializes the current editor `SceneSpec` (the last edited layout). `Preview` mode runs the runtime simulation without rewriting the scene data used for YAML export/load.

In Preview mode, formations are also mirrored into `Phaser.Physics.Arcade.Group` instances for runtime tracking (without changing the YAML schema).


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
