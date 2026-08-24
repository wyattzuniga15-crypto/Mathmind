package com.orbital.arsenal.boss;

import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Vec3d;

/**
 * The Chronarch's actual body: a floating clockwork orrery of purple stone.
 *
 * A bespoke monster model needs a client-side entity renderer, and since
 * 1.21.2 that means render states — a large API I have no way to check from
 * here, on a mod that has to work from a single jar with no client half. So
 * the shape is built instead out of invisible armour stands each wearing a
 * block on its head, arranged and spun by mod code every tick.
 *
 * That is not a workaround so much as a different trade. It is entirely
 * server-side, so it works on an unmodified client and cannot break when
 * rendering changes; and for *this* boss it is arguably the better answer,
 * because the thing it produces — nested rings turning at different speeds
 * around a core — is a clock. A hand-modelled monster would have to imply that.
 *
 * The ravager underneath is made invisible and keeps doing what it is good at:
 * being a hitbox that walks toward you and can be hit back.
 */
final class Construct {
    /**
     * How far above an armour stand's own position its head renders. Blocks are
     * placed by their intended height minus this, or the whole construct sits a
     * body-length too high.
     */
    private static final double HEAD = 1.45;

    private static final int INNER_COUNT = 3;
    private static final int OUTER_COUNT = 6;
    private static final double INNER_RADIUS = 1.15;
    private static final double OUTER_RADIUS = 2.1;

    private final List<LivingEntity> parts = new ArrayList<>();
    private LivingEntity core;
    private LivingEntity crown;
    private final List<LivingEntity> inner = new ArrayList<>();
    private final List<LivingEntity> outer = new ArrayList<>();

    private Construct() {}

    /** Assemble one around a body, or return null if the pieces cannot be made. */
    static Construct assemble(ServerWorld world, Vec3d at) {
        Construct construct = new Construct();
        construct.core = construct.piece(world, at, Blocks.CRYING_OBSIDIAN);
        construct.crown = construct.piece(world, at, Blocks.BEACON);
        for (int i = 0; i < INNER_COUNT; i++) {
            construct.inner.add(construct.piece(world, at, Blocks.AMETHYST_BLOCK));
        }
        for (int i = 0; i < OUTER_COUNT; i++) {
            construct.outer.add(construct.piece(world, at, Blocks.PURPUR_PILLAR));
        }
        if (construct.parts.stream().anyMatch(part -> part == null)) {
            construct.dispel();
            return null;
        }
        return construct;
    }

    private LivingEntity piece(ServerWorld world, Vec3d at, Block block) {
        LivingEntity stand = EntityType.ARMOR_STAND.create(world, SpawnReason.EVENT);
        if (stand == null) {
            return null;
        }
        stand.setPosition(at.x, at.y, at.z);
        // Invisible, weightless, and untouchable: the stand is scaffolding for
        // a block, not something anyone should be able to interact with.
        stand.setInvisible(true);
        stand.setNoGravity(true);
        stand.setInvulnerable(true);
        stand.equipStack(EquipmentSlot.HEAD, new ItemStack(block.asItem(), 1));
        world.spawnEntity(stand);
        parts.add(stand);
        return stand;
    }

    /**
     * Place every piece for this tick.
     *
     * The two rings turn at different speeds and in opposite directions, which
     * is what makes it read as a mechanism rather than a pile of floating
     * blocks. `wounded` speeds the whole thing up — as the fight goes on the
     * Chronarch visibly winds tighter.
     */
    void place(Vec3d at, int age, float wounded) {
        double rate = 1.0 + (1.0 - wounded) * 2.5;
        set(core, at.x, at.y + 2.2, at.z, (float) (age * 2.0 * rate));
        set(crown, at.x, at.y + 3.3, at.z, (float) (-age * 3.0 * rate));

        for (int i = 0; i < inner.size(); i++) {
            double angle = age * 0.09 * rate + (i * Math.PI * 2.0 / inner.size());
            set(inner.get(i),
                    at.x + Math.cos(angle) * INNER_RADIUS,
                    at.y + 2.2 + Math.sin(age * 0.05 + i) * 0.25,
                    at.z + Math.sin(angle) * INNER_RADIUS,
                    (float) Math.toDegrees(-angle));
        }
        for (int i = 0; i < outer.size(); i++) {
            double angle = -age * 0.045 * rate + (i * Math.PI * 2.0 / outer.size());
            set(outer.get(i),
                    at.x + Math.cos(angle) * OUTER_RADIUS,
                    at.y + 1.5 + Math.sin(age * 0.04 + i * 1.7) * 0.35,
                    at.z + Math.sin(angle) * OUTER_RADIUS,
                    (float) Math.toDegrees(-angle));
        }
    }

    private void set(LivingEntity part, double x, double y, double z, float yaw) {
        if (part == null) {
            return;
        }
        part.setPosition(x, y - HEAD, z);
        part.setYaw(yaw);
    }

    /** Take it apart. Leaving stands behind would litter the world with invisible junk. */
    void dispel() {
        for (LivingEntity part : parts) {
            if (part != null) {
                part.discard();
            }
        }
        parts.clear();
        inner.clear();
        outer.clear();
    }
}
