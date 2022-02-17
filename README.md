# Unnamed Breakout/Arkanoid clone in TypeScript

Development started February 6th and has progressed rather nicely!  
It's certainly not ready to be considered a full game, but it is playable for short periods.

## Features implemented:

* Correct collisions (except a minor issue that occurs something like 1/100k collisions -- hard to track down)
* Bricks with varying amounts of health (currently only 1-hit and indestructible are actually used)
* Several different powerups (time-limited, use count-limited and one-offs like the extra life powerup)


## Planned features:

* Level editor (maybe in TS, so that you can edit them right in the canvas)
* Many additional levels (and no random levels, as is the case of this writing)
* Scoring improvements (lower time -> higher score; perhaps combo bonuses)
* Several additional powerups
* Sound!
* More/better animations (e.g. bricks breaking, powerups being picked up)

## Build instructions:

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
