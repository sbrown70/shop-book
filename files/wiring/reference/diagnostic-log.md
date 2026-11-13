# Wiring diagnostic log

Findings from troubleshooting sessions, Nov 11–12, 2026, with the engine out of the car. Confidence is noted where a conclusion came from general knowledge rather than a measurement or the car's own diagram.

## Car state while testing (engine out)

- **Body ground:** with the engine out, the body has no factory ground. Normally it runs battery negative → engine → ground cable at the **starter relay mounting bolt** → body. A temporary jumper cable now runs from the battery negative to that cable at the relay bolt. Grounding the battery negative to a different body point did not work (poor contact).
- **Ground cable at the relay bolt:** its engine end is loose. It must go back on the engine at reinstall, with clean metal at both ends.
- **Starter cable:** keep it off the relay's starter stud, or fully insulated, while the engine is out. Verify its current state.
- **Ignition switch:** out of the dash, with the key cylinder removed.
- **Headlight switch:** out of the dash and unplugged.
- **Front parking/turn lights:** both connectors unplugged at the wheel wells.

## Starter relay (fender-mounted, passenger side)

Terminals, left to right: **battery stud, S, I, starter stud.**

| Terminal | Wire | Function | Verified behavior |
|---|---|---|---|
| Battery stud | Black/yellow (+ battery cable) | Main battery feed into the car (circuit 37) | 12 V always |
| S | Red/blue | Start signal from ignition switch (via neutral safety switch, automatic) | 12 V only in START |
| I | Brown | Full 12 V to coil while cranking. Brown joins the **pink** resistance wire at the firewall main disconnect | 12 V in ON (through the coil feed) and in START |
| Starter stud | Heavy cable to starter | Hot only while cranking | — |
| Mounting bolt | Ground cable to engine | Relay ground and engine-to-body ground | — |

**Open item: a loose solid-red wire** comes from the same firewall connector as the wires above. Its relay end is loose, and it reads **0 V in every key position**. It has not been identified. The owner believes it used to connect somewhere on the starter relay. Trace it with the wiring diagram before connecting it anywhere.

## Ignition switch

- **Bezel positions:** ACC – OFF – ON – START (spring-loaded). There is also an **unmarked cylinder-release position** counter-clockwise past ACC. Readings taken in that position were mistaken for ACC and caused confusion; ignore it.
- **The switch plug only fits one way.** A separate **eyelet (ring) terminal** on the back is the **accessory feed, circuit 297 (black-green)** per the diagram. It feeds the turn-signal flasher (circuit 8) and other accessory items.
- **Verified with correct positions:** S is hot only in START. The pink coil feed and the brown wire are hot in ON and START. Other switched items behave correctly.
- **Pink resistance wire:** reads a full 12 V unloaded. Under coil load it drops to roughly 6–9 V. Never use it as a switched-power source.

## Headlight switch and the parking-light short (found)

**Symptom:** in the parking-light (middle) position, the switch crackled and its breaker made a "ding". The taillights blinked as the breaker reset, and the front parking lights never lit. A crackle at the starter relay turned out to be arcing at the relay-bolt ground connection, with short-circuit current returning through it. It was not the relay switching.

**Isolated to:** circuit **11 (front parking lights)**, in the **passenger-side front parking-light wiring past the wheel-well connector.** Unplugging that connector stopped the crackling. Unplugging the driver side did not.

**Switch continuity map** (from the owner's chart, `photos/headlight-switch-continuity-map.jpg`; terminal letters as stamped). The switch appears to work as designed:

| Position | Battery (B) connects to |
|---|---|
| Off (in) | A (I–R also connected, through the dash-light dimmer) |
| Middle (park) | R, P, I, A |
| Fully out (headlights) | R, H, I, A |

- **P** = front parking lights, live only in the middle position. On '60s Fords the front parking lights go off when the headlights come on.
- **R** = taillights.
- **H** = headlights.
- **I** = instrument (dash) lights.
- **D1, D2** = likely dome/courtesy.
- **A** is unconfirmed.

**Dash light feed:** a blue wire with a three-way splitter. It reads "grounded" with the lights off, through the dash bulbs, and is powered with the lights on, dimmed by the headlight knob. It is **not a ground.** It has a spare unused branch, a good source for the tach light and radio illumination.

## Turn signals (in progress)

Circuit path, per the Haynes diagram:

- Ignition switch eyelet (297) → **8, orange-yellow** → flasher → **44, blue** → turn-signal switch's **four-wire connector**.
- That connector carries **44 blue, 10 green-red (brake), 2 white-blue (front), 3 green-white (front).**
- The rear lights get **5 orange-blue** and **9 green-orange** through a separate **two-pin plug**.

Results so far:

- **Brake lights work.** That proves the rear wiring, sockets and bulbs, and the switch's brake contacts.
- **Flasher works.** A jumper test made a rear light blink through it.
- **Flasher feed works.** Orange (8) jumpered to a rear pin gave a steady light.
- **Blue (44) works to the car side of the four-wire connector.** A jumper from there to a rear pin blinked.
- **With the harness connected:** blue reads 12 V at the four-wire connector, but white-blue and green-white read 0 V in every lever position.
- **Conclusion:** the fault is in the **turn-signal switch** or the **blue pin's contact between the four-wire connector halves.**
- **Next test:** both switch plugs unplugged, battery disconnected, switch-side halves only. Check continuity from blue to each front and rear pin with the lever left, right and neutral.
  - Left → one front and one rear pin, right → the other pair: the switch is good, so repair the connector pin.
  - Otherwise, replace the turn-signal switch.
- **Open question:** both flasher terminals read 12 V even with the key OFF. Per the diagram, the flasher is fed from the accessory circuit and should be dead in OFF. Not yet explained.

## Heater fan

- **The '66 blower is switched on the ground side** (forum source). The motor has power on one wire; the switch grounds the motor through the resistor taps. High = no resistor, lower speeds = more resistance.
- **Motor, its power and the resistor all work.** Grounding a resistor terminal with a jumper runs the fan.
- **The factory switch, with its housing grounded, never grounds any output in any position,** so the fan doesn't run. **Decision: replace the heater fan switch.**
- **Your uncle's pot wiring has been removed.** The motor's control wire is now on the resistor.
- **Don't run low or medium for long with the resistor outside the heater box.** It relies on the blower's airflow for cooling.

## General lessons

- **Continuity tests are misleading wherever bulbs or motors are connected.** Cold filaments read close to 0 Ω, so pull bulbs or unplug loads first.
- **Use a test light (current-limited) instead of a bare jumper when hunting shorts.** A bare jumper bypasses the breaker.
- **Battery disconnected:** use the multimeter (ohms or continuity). **Battery connected:** use voltage or the test light.
- **Back-probing** means measuring at a plugged-in connector by sliding a thin probe in from behind beside the wire.
