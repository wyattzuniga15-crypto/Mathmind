#!/usr/bin/env python3
"""Which section of the manual each item belongs in.

The manual is generated from the mod itself — names from the lang file,
descriptions from each item's javadoc, recipes from the recipe JSON — so the
only thing it cannot work out on its own is which heading an item sits under.
That is this table, and verify.py refuses any registered item missing from it,
so a new item cannot quietly go undocumented.
"""

SECTIONS = [
    ("strikes", "Orbital strikes",
     "Called down from the sky. Aim, use, and stand somewhere else."),
    ("weapons", "Weapons",
     "Point and fire. These hurt things and everything they were standing on."),
    ("sculptures", "Falling sculptures",
     "A solid object twenty to forty blocks across, dropped from a hundred up. "
     "It holds its shape the whole way down and leaves a crater."),
    ("terrain", "Terraforming",
     "Reshaping the ground itself — hills, canyons, lakes, ice."),
    ("builders", "Builders",
     "They put things up rather than take them down."),
    ("gadgets", "Gadgets",
     "Getting about, finding things, and staying alive."),
    ("time", "Time",
     "The clocks undo what happened. Everything the mod changes is recorded, "
     "so a rewind puts it all back."),
    ("creatures", "Creatures",
     "Eight mobs with models of their own. Each one has an item that calls it."),
    ("fun", "For fun",
     "No practical use whatsoever."),
]

CATEGORY = {
    # Orbital strikes
    "strike_cannon": "strikes", "tactical_nuke": "strikes", "meteor_crater": "strikes",
    "meteor_storm": "strikes", "nuke_suitcase": "strikes", "carpet_bomb": "strikes",
    "anvil_rain": "strikes", "supply_drop": "strikes", "orbital_laser": "strikes",
    "lightning_caller": "strikes",
    # Weapons
    "kamehameha": "weapons", "black_hole": "weapons", "black_hole_grenade": "weapons",
    "disintegrator": "weapons", "napalm_launcher": "weapons", "railgun": "weapons",
    "shotgun_blast": "weapons", "acid_spray": "weapons", "sonic_cannon": "weapons",
    "chain_lightning": "weapons", "ice_spikes": "weapons", "landmine": "weapons",
    "swarm_missiles": "weapons", "earthquake_hammer": "weapons", "gravity_gun": "weapons",
    "potato_bomb": "weapons", "cat_bazooka": "weapons", "freeze_ray": "weapons",
    "glass_cannon": "weapons", "fossilise": "weapons", "midas_touch": "weapons",
    "shrink_ray": "weapons", "vaporise": "weapons", "black_ice": "weapons",
    "quicksand": "weapons", "stampede": "weapons", "tornado_jar": "weapons",
    "snowball_gun": "weapons", "doppelganger": "weapons",
    # Sculptures
    **{k: "sculptures" for k in (
        "giant_anchor", "giant_anvil", "giant_bell", "giant_boot", "giant_cake",
        "giant_chicken", "giant_crown", "giant_diamond", "giant_dice", "giant_donut",
        "giant_duck", "giant_gramophone", "giant_guitar", "giant_hammer",
        "giant_hourglass", "giant_ice_cream", "giant_key", "giant_lighthouse",
        "giant_mushroom", "giant_rocket", "giant_skull", "giant_sword", "giant_teapot",
        "giant_trophy", "giant_windmill", "grand_piano",
        "giant_hot_air_balloon", "giant_chess_knight", "giant_light_bulb")},
    # Terraforming
    "terraformer": "terrain", "mountain_maker": "terrain", "canyon_carver": "terrain",
    "lake_maker": "terrain", "ice_age": "terrain", "forest_grower": "terrain",
    "landscaper": "terrain", "foundation": "terrain", "excavator": "terrain",
    "repair": "terrain", "skylight": "terrain", "overgrowth": "terrain",
    "crystal_growth": "terrain", "volcano_seed": "terrain", "sky_island": "terrain",
    "weather_control": "terrain", "time_of_day": "terrain", "mineshaft": "terrain",
    "farm_plot": "terrain", "tunnel_borer": "terrain",
    # Builders
    "bridge_builder": "builders", "tower_builder": "builders", "road_builder": "builders",
    "maze_maker": "builders", "dungeon_maker": "builders", "block_printer": "builders",
    "auto_miner": "builders", "cloner": "builders", "hologram": "builders",
    "pyramid": "builders", "cabin": "builders", "glass_dome": "builders",
    "rail_layer": "builders", "portal_frame": "builders", "elevator": "builders",
    "trampoline": "builders", "bouncy_ground": "builders", "beacon_marker": "builders",
    "torch_bomb": "builders", "rampart": "builders", "moat": "builders",
    "arena": "builders", "vault": "builders", "ski_slope": "builders",
    "waterslide": "builders", "aquarium": "builders", "statue": "builders",
    # Gadgets
    "portal_gun": "gadgets", "teleport_staff": "gadgets", "grappling_hook": "gadgets",
    "jetpack": "gadgets", "speed_boots": "gadgets", "water_walking": "gadgets",
    "wall_phase": "gadgets", "gravity_flip": "gadgets", "item_magnet": "gadgets",
    "ore_finder": "gadgets", "ore_sense": "gadgets", "homing_compass": "gadgets",
    "vein_miner": "gadgets", "updraft": "gadgets", "recall": "gadgets",
    "swap": "gadgets", "decoy": "gadgets", "featherfall": "gadgets",
    "bottled_chunk": "gadgets",
    # Time
    "rewind_clock": "time", "long_rewind_clock": "time", "deep_rewind_clock": "time",
    "genesis_clock": "time", "fast_forward_clock": "time", "slow_time_clock": "time",
    "time_stop_clock": "time", "time_bubble": "time", "echo_ghost": "time",
    "echo_beacon": "time",
    # Creatures
    "chronarch_seal": "creatures", "chronarch_heart": "creatures",
    "sky_whale_egg": "creatures", "titan_seal": "creatures", "dragon_egg_orb": "creatures",
    "spider_core": "creatures", "golem_heart": "creatures", "kraken_pearl": "creatures",
    "phoenix_ash": "creatures", "growing_cat": "creatures", "chicken_rain": "creatures",
    "pet_rock": "creatures", "menagerie": "creatures",
    # For fun
    "firework_show": "fun", "disco_floor": "fun", "confetti_cannon": "fun",
    "rainbow_trail": "fun", "boombox": "fun", "party_mode": "fun",
    "fireflies": "fun", "balloon_release": "fun",
}

MOBS = [
    ("chronarch", "Chronarch", "chronarch_seal",
     "The one the mod is named around. Enormous, and it does not fit through a door."),
    ("sky_whale", "Sky Whale", "sky_whale_egg",
     "Five blocks long, drifts rather than walks, and is entirely harmless."),
    ("titan", "Titan", "titan_seal",
     "Seven blocks of bronze plate. Slow, and it does not stop."),
    ("dragon", "Dragon", "dragon_egg_orb",
     "Wings, a long neck and a longer tail. It flies at you."),
    ("mecha_spider", "Mecha Spider", "spider_core",
     "Six legs on a chassis, with a light bar for a face."),
    ("golem", "Stone Golem", "golem_heart",
     "Five hundred hit points, a lit core in its chest, and no hurry at all."),
    ("kraken", "Kraken", "kraken_pearl",
     "A mantle over eight arms, each curling on its own. It reaches further than it looks."),
    ("phoenix", "Phoenix", "phoenix_ash",
     "A small bird under a three-block wingspan. Fast, and it does not stay down."),
]


# Where the javadoc cannot tell four items apart. The rewind clocks share one
# class and differ only in how far back they reach, so the class comment says
# the same thing for all four.
NOTES = {
    "rewind_clock": "Puts the last minute back — every block this mod changed, "
                    "and everything you built by hand along with it.",
    "deep_rewind_clock": "The last five minutes, undone.",
    "long_rewind_clock": "The last ten minutes, undone.",
    "genesis_clock": "Everything, undone. The whole recording, back to the "
                     "first block the mod ever moved.",
}
