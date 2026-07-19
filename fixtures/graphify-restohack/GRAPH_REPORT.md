# Graph Report - .  (2026-07-18)

## Corpus Check

- 170 files · ~200,197 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 984 nodes · 2930 edges · 84 communities (53 shown, 31 thin omitted)
- Extraction: 49% EXTRACTED · 51% INFERRED · 0% AMBIGUOUS · INFERRED: 1503 edges (avg confidence: 0.8)
- Token cost: 220,783 input · 0 output

## Community Hubs (Navigation)

- Ice Box & Apply-Object Commands
- Naming, Positioning & Death Sequence
- Trap System & Core Command Dispatch
- Save Format Pointer Serialization (v1.1.5)
- Level/Room Generation (mklev)
- Dog/Pet AI
- Object/Monster/Room Header Definitions
- Build System & K&R-to-ANSI Modernization History
- Monster Naming & Combat Death Handling
- Screen Rendering & Trap Display
- Camera, Digging & Line-of-Sight
- Monster-vs-Monster Fighting
- Monster-Hits-Player Combat
- Thrown Weapons & Potion Effects
- Scroll Reading & Mail/Date Utilities
- Extended Commands & Direction Input
- Worm Segments
- Bones Files & Wizard Mode Utilities
- ioctl/Terminal Setup
- Object Class Struct (objclass) - variant A
- Play-Testing Harness: Golden Baselines & HackEnv
- Object Class Struct (objclass) - variant B
- Monster Creation (makemon)
- Screen Redraw & Status Display
- Priority Rendering & Vision
- Development Phases: Stub-Driven Build to Playable Game
- File Locking & Tombstone Rendering
- Whistle/Apply Commands & Maze Generation
- Shopkeeper System
- Eating & Rumors System
- makedefs.c Code Generator
- Hack (1984) Development History & Contributors
- Save/Restore of Worms & Inventory
- Bones Files & Game Locking
- argv[0]/PATH Fix & RNG Seed CLI Flag
- Command Table & Control-Char Handling
- Working-Directory Change & Startup Errors
- Object Initialization & Discovery
- Monster Creation Helpers
- Monster Find-Position Utilities
- Scroll Reading (levl)
- Date/Mail Utilities
- Config & Object Class Headers
- Object Naming Utilities
- Game Options Parsing
- Object Creation (mkobj)
- Full Moon Screenshot & Status Bar
- K&R Conversion Phases 1B-1D
- Bones Files & Wizard Flag
- Player Name Suffix (u_init)
- restoHack Project Identity & Banner
- P0 Steam Readiness Bugs
- Version Reporting
- game_runner.py Sanitizer Driver
- download_hack.sh Script
- hack.sh Launch Script
- diff_runner.py Binary Comparison Tool
- Play-Testing Harness Plan & Spec
- scripted_agent.py Key-Sequence Agent
- CMake Build Types
- ncurses Dependency
- Platform-Specific Build Notes
- Inventory Linked-List Conversion Notes
- Object Creation Conversion Notes
- Portable RNG Seeding (v1.0.3)
- Hybrid Binary+Source Tarballs (v1.0.4)
- Historical References & CMake Fix (v1.0.6)
- SIGWINCH Terminal Resize Protection (v1.1.0)
- Documentation Updates (v1.1.2)
- Save/Restore Crash Fix (v1.1.4)
- BSD Games History Reference
- RogueBasin Community Reference
- USENIX Tape Distribution History
- Tombstone Death Screen
- First-Time User Startup Sequence
- Release Packaging Automation
- Runtime Dependency Audit
- Steam Compatibility Matrix

## God Nodes (most connected - your core abstractions)

1. `pline()` - 176 edges
2. `rn2()` - 93 edges
3. `main()` - 60 edges
4. `rnd()` - 45 edges
5. `doread()` - 39 edges
6. `cansee()` - 38 edges
7. `done()` - 38 edges
8. `domove()` - 36 edges
9. `dothrow()` - 36 edges
10. `impossible()` - 34 edges

## Surprising Connections (you probably didn't know these)

- `some_armor()` --calls--> `rn2()`  [INFERRED]
  docs/historical/original-source/hack.do_wear.c → src/rnd.c
- `morguemon()` --calls--> `rn2()`  [INFERRED]
  docs/historical/original-source/hack.mkshop.c → src/rnd.c
- `somegold()` --calls--> `rnd()`  [INFERRED]
  docs/historical/original-source/hack.steal.c → src/rnd.c
- `news0()` --calls--> `cansee()`  [INFERRED]
  docs/historical/original-source/hack.pri.c → src/hack.c
- `use_camera()` --calls--> `getdir()`  [INFERRED]
  docs/historical/original-source/hack.apply.c → src/hack.cmd.c

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Harness Three-Layer Architecture (Env, Regression, Agents)** — docs_superpowers_plans_2026_06_06_harness_hackenv, docs_superpowers_plans_2026_06_06_harness_golden, docs_superpowers_plans_2026_06_06_harness_diff_runner, docs_superpowers_plans_2026_06_06_harness_random_agent, docs_superpowers_plans_2026_06_06_harness_scripted_agent [EXTRACTED 1.00]
- **Hack Lineage: Rogue to Fenlason's Hack to Brouwer's Hack to NetHack** — docs_history_of_hack_rogue, docs_history_of_hack_hack_fenlason_era, docs_history_of_hack_hack_1_0, docs_history_of_hack_nethack [INFERRED 0.85]
- **Files Complying with Documentation Policy for Non-Original Code** — src_hack_u_init, src_hack_end, src_hack_termcap, src_hack_timeout, src_hack_cmd, src_hack_rip, src_hack_lock [EXTRACTED 1.00]

## Communities (84 total, 31 thin omitted)

### Community 0 - "Ice Box & Apply-Object Commands"

Cohesion: 0.06
Nodes (76): use_ice_box(), drop(), lint, dorr(), doapply(), holetime(), in_ice_box(), out_ice_box() (+68 more)

### Community 1 - "Naming, Positioning & Death Sequence"

Cohesion: 0.06
Nodes (73): coord, getpos(), NOSAVEONHANGUP, done1(), done_hangup(), done_intr(), eos(), occ_cnt() (+65 more)

### Community 2 - "Trap System & Core Command Dispatch"

Cohesion: 0.06
Nodes (62): Phase 1A — Trap System Integration (hack.trap.c, 9 functions), all(), QUEST, nomul(), sgn(), boolean, doddrop(), dodown() (+54 more)

### Community 3 - "Save Format Pointer Serialization (v1.1.5)"

Cohesion: 0.07
Nodes (59): v1.1.5 — Save Format Pointer Serialization (SAVE_VERSION 2), NOSAVEONHANGUP, dosave0(), Rationale: Preserve 1984 chdir(HACKDIR) save architecture over XDG/AppData, Save-File Corruption Detection (post-restore invariant checks), Legacy Save Migration Loader (version-dispatched restore), Rationale: Option A (raw struct dump + explicit pointer serialization) chosen — Hardfought runs a single canonical binary, Option B — Field-by-Field Serialization (Deferred, cross-architecture goal) (+51 more)

### Community 4 - "Level/Room Generation (mklev)"

Cohesion: 0.08
Nodes (41): coord, QUEST, finddpos(), makerooms(), addrs(), addrsx(), boolean, coord (+33 more)

### Community 5 - "Dog/Pet AI"

Cohesion: 0.10
Nodes (37): dighole(), dogfood(), initedog(), inroom(), makedog(), tamedog(), poisonous(), impossible() (+29 more)

### Community 7 - "Build System & K&R-to-ANSI Modernization History"

Cohesion: 0.07
Nodes (28): CMake Build System, Static Binary Build (Alpine/musl), K&R to ANSI Conversion Wave (July 2025, 57 functions), hack.u_init.c K&R to ANSI Conversion Notes, v1.0.0 — Initial Public Release of restoHack, v1.0.1 — flock()-based Locking, K&R to ANSI Conversion, v1.0.2 — Static Binary Release for Linux x86_64, v1.0.5 — Coding Standards Documentation Added (+20 more)

### Community 8 - "Monster Naming & Combat Death Handling"

Cohesion: 0.15
Nodes (27): boolean, hmon(), dbon(), amonnam(), monnam(), done_in_by(), attack(), boolean (+19 more)

### Community 9 - "Screen Rendering & Trap Display"

Cohesion: 0.19
Nodes (24): NOWORM, x, y, prl(), deltrap(), m_at(), atl(), newsym() (+16 more)

### Community 10 - "Camera, Digging & Line-of-Sight"

Cohesion: 0.19
Nodes (23): use_camera(), abon(), bchit(), dig(), use_camera(), cansee(), isok(), domove() (+15 more)

### Community 11 - "Monster-vs-Monster Fighting"

Cohesion: 0.21
Nodes (17): dog_move(), fightm(), hitmm(), mondied(), monstone(), coord, m_move(), mfndpos() (+9 more)

### Community 12 - "Monster-Hits-Player Combat"

Cohesion: 0.22
Nodes (16): hitu(), mhitu(), canseemon(), dmonsfree(), dochug(), dochugw(), ishuman(), justswld() (+8 more)

### Community 13 - "Thrown Weapons & Potion Effects"

Cohesion: 0.19
Nodes (15): boomhit(), dx, dy, dothrow(), set_wounded_legs(), thitu(), potionbreathe(), potionhit() (+7 more)

### Community 15 - "Scroll Reading & Mail/Date Utilities"

Cohesion: 0.20
Nodes (14): identify(), monstersym(), ckmailstatus(), getdatestr(), getlt(), getmailstatus(), getyear(), midnight() (+6 more)

### Community 16 - "Extended Commands & Direction Input"

Cohesion: 0.22
Nodes (12): use_pick_axe(), boolean, confdir(), doextcmd(), finddir(), getdir(), hack_unctrl(), isroom() (+4 more)

### Community 17 - "Worm Segments"

Cohesion: 0.22
Nodes (12): newcham(), rescham(), uchar, xchar, cutworm(), getwn(), initworm(), remseg() (+4 more)

### Community 18 - "Bones Files & Wizard Mode Utilities"

Cohesion: 0.26
Nodes (13): savebones(), fall_down(), keepdogs(), relmon(), unpmon(), somegold(), stealgold(), aggravate() (+5 more)

### Community 19 - "ioctl/Terminal Setup"

Cohesion: 0.17
Nodes (3): BSD, objclass, setioctls()

### Community 20 - "Object Class Struct (objclass) - variant A"

Cohesion: 0.15
Nodes (13): schar, uchar, objclass, oc_delay, oc_descr, oc_name, oc_oc1, oc_oc2 (+5 more)

### Community 21 - "Play-Testing Harness: Golden Baselines & HackEnv"

Cohesion: 0.19
Nodes (13): golden.py — Record/Verify Golden Baselines, HackEnv Class (PTY process management, reset/step API), random_agent.py — Random Walk Crash-Finding Agent, replays/ (gitignored) vs goldens/ (committed) Directory Split, schema.py — Observation/Termination Dataclasses, screen_parser.py — Pure pyte-buffer to Observation Parser, golden.py Design (record/verify modes), HackEnv Public API (reset(seed)/step(action)) (+5 more)

### Community 22 - "Object Class Struct (objclass) - variant B"

Cohesion: 0.15
Nodes (13): schar, uchar, objclass, oc_delay, oc_descr, oc_name, oc_oc1, oc_oc2 (+5 more)

### Community 23 - "Monster Creation (makemon)"

Cohesion: 0.29
Nodes (12): losedogs(), coord, xchar, enexto(), goodpos(), makemon(), mkmon_at(), rloc() (+4 more)

### Community 24 - "Screen Redraw & Status Display"

Cohesion: 0.26
Nodes (12): askname(), check_resize(), main(), bot(), cls(), docrt(), doredraw(), seemons() (+4 more)

### Community 25 - "Priority Rendering & Vision"

Cohesion: 0.18
Nodes (11): ch, mode(), lint, QUEST, u, if(), news0(), unpobj() (+3 more)

### Community 26 - "Development Phases: Stub-Driven Build to Playable Game"

Cohesion: 0.23
Nodes (11): Phase 0E — Executable Creation via Stub-Driven Development, Phase 0F — System Integration (objnam, o_init, pager, makemon, tty), Phase 0G — Fully Playable 1984 Hack, Phase 0H — Polish (hackdir structure, silenced debug spam), Phase 1 — Experienced Player Crash (read-only string literal bug), find_ac(), init_uhunger(), ini_inv() (+3 more)

### Community 27 - "File Locking & Tombstone Rendering"

Cohesion: 0.18
Nodes (8): Record Lock Fix — Stale Lock Detection (link()-based, 5 min timeout), Existing Documented Modern Additions (7 files), Original Code Preservation Audit (Compliant Files), modern_cleanup_locks(), modern_lock_record(), modern_unlock_game(), center(), outrip()

### Community 28 - "Whistle/Apply Commands & Maze Generation"

Cohesion: 0.18
Nodes (4): use_magic_whistle(), use_whistle(), coord, mazexy()

### Community 29 - "Shopkeeper System"

Cohesion: 0.17
Nodes (5): morguemon(), QUEST, x, y, online()

### Community 30 - "Eating & Rumors System"

Cohesion: 0.27
Nodes (10): else, QUEST, if(), otmp, FILE, init_rumors(), outline(), outrumor() (+2 more)

### Community 31 - "makedefs.c Code Generator"

Cohesion: 0.36
Nodes (9): nextchar(), capitalize(), digit(), getentry(), letter(), main(), nextchar(), readline() (+1 more)

### Community 32 - "Hack (1984) Development History & Contributors"

Cohesion: 0.18
Nodes (11): Jay Fenlason Interview (2000), Julie Bresnick, Linux.com, Glenn Wichman (co-creator of Rogue, UC Santa Cruz), Hack Development, Fenlason Era (~1981-1984), Jay Fenlason (creator of Hack, high school student ~1981-1984), Jonathan Payne (early Hack co-developer, creator of JOVE editor), Ken Arnold (UC Berkeley, curses support for Rogue), Kenny Woodland (early Hack co-developer), Michael Toy (co-creator of Rogue, UC Santa Cruz) (+3 more)

### Community 33 - "Save/Restore of Worms & Inventory"

Cohesion: 0.22
Nodes (5): bwrite(), NOWORM, mread(), lint, while()

### Community 34 - "Bones Files & Game Locking"

Cohesion: 0.24
Nodes (9): fd(), getbones(), mklev(), modern_lock_game(), glo(), getlock(), regularize(), uptodate() (+1 more)

### Community 35 - "argv[0]/PATH Fix & RNG Seed CLI Flag"

Cohesion: 0.29
Nodes (6): Unix/Linux Compatibility Fix — 'Cannot get status of hack' (PATH detection), v1.1.3 — 'Cannot get status of hack' argv[0] Fix, gethdate()/chdirx() Critical Ordering Constraint, -s SEED CLI Flag Implementation Task (hack.main.c), -s SEED Flag Design (RNG audit prerequisite), stop_occupation()

### Community 36 - "Command Table & Control-Char Handling"

Cohesion: 0.29
Nodes (4): QUEST, isok(), while(), tlist

### Community 37 - "Working-Directory Change & Startup Errors"

Cohesion: 0.36
Nodes (8): chdirx(), boolean, chdirx(), setclipped(), startup(), error(), getret(), gethdate()

### Community 38 - "Object Initialization & Discovery"

Cohesion: 0.46
Nodes (7): dodiscovered(), init_objects(), interesting_to_discover(), letindex(), oinit(), probtype(), setgemprobs()

### Community 39 - "Monster Creation Helpers"

Cohesion: 0.38
Nodes (6): anything, coord, NOWORM, do(), enexto(), if()

### Community 40 - "Monster Find-Position Utilities"

Cohesion: 0.33
Nodes (4): NOWORM, u, if(), mtmp

### Community 41 - "Scroll Reading (levl)"

Cohesion: 0.40
Nodes (4): else, QUEST, if(), levl

### Community 42 - "Date/Mail Utilities"

Cohesion: 0.50
Nodes (4): getdate(), getlt(), regularize(), MAIL

### Community 45 - "Game Options Parsing"

Cohesion: 0.60
Nodes (4): boolean, doset(), initoptions(), parseoptions()

### Community 46 - "Object Creation (mkobj)"

Cohesion: 0.83
Nodes (3): mkobj(), let, letter

### Community 47 - "Full Moon Screenshot & Status Bar"

Cohesion: 0.67
Nodes (4): "Full moon tonight" Luck Message, Full Moon Gameplay Screenshot, Hack Status Bar (Level/Hp/Ac/Str/Exp), Pet Dog Attacking Jackal

### Community 48 - "K&R Conversion Phases 1B-1D"

Cohesion: 0.67
Nodes (3): Phase 1C — K&R Conversion (apply, dog, do_name, shk), Phase 1D — Final K&R Conversion (100+ functions, 15+ files), Phase 1B — 65+ Stub Implementations (shops, monster AI, worms)

### Community 51 - "restoHack Project Identity & Banner"

Cohesion: 1.00
Nodes (3): Hack (1984) original roguelike, restoHack Project (concept), restoHack Banner Image

### Community 52 - "P0 Steam Readiness Bugs"

Cohesion: 0.67
Nodes (3): Bug: 'news' file missing from install rules (welcome banner silently skipped), Prioritized Remaining Work (P0-P3), Bug: hackdir/record_lock committed to git (should be .gitignored)

## Knowledge Gaps

- **85 isolated node(s):** `oc_name`, `oc_descr`, `oc_uname`, `oc_olet`, `oc_prob` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `pline()` connect `Ice Box & Apply-Object Commands` to `Naming, Positioning & Death Sequence`, `Trap System & Core Command Dispatch`, `Save Format Pointer Serialization (v1.1.5)`, `Level/Room Generation (mklev)`, `Dog/Pet AI`, `Monster Naming & Combat Death Handling`, `Screen Rendering & Trap Display`, `Camera, Digging & Line-of-Sight`, `Monster-vs-Monster Fighting`, `Monster-Hits-Player Combat`, `Thrown Weapons & Potion Effects`, `Scroll Reading & Mail/Date Utilities`, `Extended Commands & Direction Input`, `Worm Segments`, `Bones Files & Wizard Mode Utilities`, `Monster Creation (makemon)`, `Screen Redraw & Status Display`, `Whistle/Apply Commands & Maze Generation`, `Eating & Rumors System`, `Save/Restore of Worms & Inventory`, `Bones Files & Game Locking`, `argv[0]/PATH Fix & RNG Seed CLI Flag`, `Object Initialization & Discovery`, `Scroll Reading (levl)`, `Game Options Parsing`, `Bones Files & Wizard Flag`, `Version Reporting`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Why does `rn2()` connect `Bones Files & Wizard Mode Utilities` to `Ice Box & Apply-Object Commands`, `Trap System & Core Command Dispatch`, `Save Format Pointer Serialization (v1.1.5)`, `Level/Room Generation (mklev)`, `Dog/Pet AI`, `Object/Monster/Room Header Definitions`, `Monster Naming & Combat Death Handling`, `Screen Rendering & Trap Display`, `Camera, Digging & Line-of-Sight`, `Monster-vs-Monster Fighting`, `Monster-Hits-Player Combat`, `Thrown Weapons & Potion Effects`, `Extended Commands & Direction Input`, `Worm Segments`, `Monster Creation (makemon)`, `Screen Redraw & Status Display`, `Development Phases: Stub-Driven Build to Playable Game`, `Whistle/Apply Commands & Maze Generation`, `Shopkeeper System`, `Eating & Rumors System`, `Bones Files & Game Locking`, `Object Initialization & Discovery`, `Monster Creation Helpers`, `Object Creation (mkobj)`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `main()` connect `Screen Redraw & Status Display` to `Ice Box & Apply-Object Commands`, `Naming, Positioning & Death Sequence`, `Trap System & Core Command Dispatch`, `Save Format Pointer Serialization (v1.1.5)`, `Dog/Pet AI`, `Screen Rendering & Trap Display`, `Camera, Digging & Line-of-Sight`, `Monster-Hits-Player Combat`, `Thrown Weapons & Potion Effects`, `Scroll Reading & Mail/Date Utilities`, `Extended Commands & Direction Input`, `Bones Files & Wizard Mode Utilities`, `Monster Creation (makemon)`, `Development Phases: Stub-Driven Build to Playable Game`, `File Locking & Tombstone Rendering`, `Bones Files & Game Locking`, `argv[0]/PATH Fix & RNG Seed CLI Flag`, `Working-Directory Change & Startup Errors`, `Object Initialization & Discovery`, `Game Options Parsing`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 170 inferred relationships involving `pline()` (e.g. with `all()` and `use_camera()`) actually correct?**
  _`pline()` has 170 INFERRED edges - model-reasoned connections that need verification._
- **Are the 92 inferred relationships involving `rn2()` (e.g. with `use_camera()` and `some_armor()`) actually correct?**
  _`rn2()` has 92 INFERRED edges - model-reasoned connections that need verification._
- **Are the 55 inferred relationships involving `main()` (e.g. with `finddir()` and `rhack()`) actually correct?**
  _`main()` has 55 INFERRED edges - model-reasoned connections that need verification._
- **Are the 44 inferred relationships involving `rnd()` (e.g. with `use_camera()` and `if()`) actually correct?**
  _`rnd()` has 44 INFERRED edges - model-reasoned connections that need verification._
