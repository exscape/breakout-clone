# Unnamed Breakout/Arkanoid clone in TypeScript

Development started February 6th and has progressed rather nicely!
It's certainly not ready to be considered a full game, but it is playable for short periods.

## Features implemented:

* Bricks with varying amounts of health (currently only 1-hit and indestructible are actually used, though)
* Several different powerups (time-limited, use count-limited and one-offs like the extra life powerup)
* Fairly powerful level editor with a grid, support for symmetry (horizontal and vertical, around any chosen point), block selection/dragging/copying etc.
* Standalone mode (where anyone can create levels that everyone can see and play)

## Planned features:

* "Campaign" mode, with a pre-determined progression of levels
* Many additional levels, especially in campaign mode, where the best levels I create will likely end up
* Scoring improvements (lower time -> higher score; perhaps combo bonuses)
* Several additional powerups
* Sound!
* More/better animations (e.g. bricks breaking, powerups being picked up)

## Known issues:

* Code quality is varying; some files are shamefully bad as I didn't feel like implementing a full UI toolkit, and went with ugly hacks instead.

## Build instructions:

Currently only the game itself is open source; the backend (for storing levels, handling user creation/login etc) needs more work, code quality wise.
I also have no scripts for things such as creating the database and its tables, but rather handle that manually in the database CLI.
Unfortunately this means you can't really run this on your own yet, but need to rely on my server.

As for the frontend:
The project uses npm and parcel.
Something like this should work on Linux and similar OS:es (including WSL):

* git clone https://github.com/exscape/breakout-clone.git
* cd breakout-clone
* npm i
* npm audit fix # if vulnerabilities are found
* Edit launch_parcel to remove "--public-url /game/"
* ./launch_parcel
* Open the URL printed by parcel in a browser

![Screenshot -- possibly already outdated](/screenshot.png)

## Credits

Almost all graphics are original, but a few icons are sourced from the web:

* [Icons8](https://icons8.com) (as of this writing: the icons for New, Open and Delete)
