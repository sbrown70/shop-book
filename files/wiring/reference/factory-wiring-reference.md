# Factory wiring reference: 1966 Mustang

Drawn from the Haynes manual (36048, 1964½–1973 V8) and a printed set of wiring diagrams labeled **1965 Mustang Exterior Lighting, Turn Signals and Horns** (photos in `../photos/`). The car is a 1966, so confirm colors on the car itself; a '66-specific diagram is on the to-do list.

## Haynes color code (as printed on the diagram)

Where a line lists two numbers, both are printed on that line of the legend.

| Circuit(s) | Color |
|---|---|
| 49, 2 | White-blue |
| 50, 3 | Green-white |
| 5 | Orange-blue |
| 8 | Orange-yellow |
| 9 | Green-orange |
| 10 | Green-red |
| 10A | Green |
| 37, 11 | Black-yellow |
| 34, 12 | Green-black |
| 13 | Red-black |
| 57, 14 | Black |
| 15 | Red-yellow |
| 460, 21 | Yellow |
| 25 | Black-orange |
| 44 | Blue |
| 140 | Black-red |
| 297 | Black-green |
| 461 | Yellow-green |

## Circuit functions (read from the diagrams)

| Circuit | Function |
|---|---|
| 37 | Battery feed from the starter relay battery stud through the main disconnect |
| 297 | Ignition switch accessory output (the eyelet terminal); feeds circuit 8 |
| 8 | Feed into the turn-signal flasher |
| 44 | Flasher output to the turn-signal switch |
| 10 | Stoplight switch to the turn-signal switch (brake lights) |
| 2, 3 | Turn-signal switch to the front turn signals |
| 5, 9 | Turn-signal switch to the rear stop/turn lights (separate two-pin plug) |
| 11 | Headlight switch to the front parking lights |
| 14 | Taillights |
| 15 | Headlight switch to the dimmer switch |
| 12, 13 | Dimmer switch to the headlights (high and low beam) |
| 57 | Ground |
| 140 | Backup lights (through the starter neutral switch) |
| 460, 461 | Horn |

## Starting and ignition (general Ford practice, plus measurements on this car)

- **Battery and starter relay** are on the passenger-side front.
- **Relay terminals:** battery stud (always hot), starter stud (hot only while cranking), S (start signal in), I (full 12 V to the coil while cranking).
- **The relay grounds through its mounting bolt.**
- **The coil is fed** through the pink resistance wire in RUN, and with full voltage from the relay's I terminal in START.
- **Battery negative goes to the engine,** and the body is grounded from the engine through the cable at the relay bolt.
- **Starter relay "click" test:** with the starter cable off, the relay should click and the starter stud should read 12 V **only** in START.

## Key accessory connection points for the new install

- **Fuse-block trigger:** a circuit hot in ACC and ON. The ignition switch accessory output (297) is the natural source. **Never use the pink coil feed.**
- **Tach signal:** the coil's **−** terminal.
- **Tach light and radio illumination:** the spare branch of the blue dash-light splitter.
