package com.orbital.arsenal.client;

import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;

/**
 * The Chronarch's shape: a clock that walks.
 *
 * A heavy stone core with a beacon-lit crown, carried on two pillar legs,
 * with a ring around its middle and a pair of hands on its face that turn as
 * it moves. Everything is boxes, because that is what a Minecraft entity model
 * is — the character comes from proportion and from what moves, not detail.
 *
 * The two hands turn at different rates and never reset, which is what makes
 * it read as a mechanism rather than a statue with arms.
 */
public class ChronarchModel extends EntityModel<LivingEntityRenderState> {
    private final ModelPart core;
    private final ModelPart crown;
    private final ModelPart ring;
    private final ModelPart bigHand;
    private final ModelPart smallHand;
    private final ModelPart leftLeg;
    private final ModelPart rightLeg;

    public ChronarchModel(ModelPart root) {
        super(root);
        this.core = root.getChild("core");
        this.crown = this.core.getChild("crown");
        this.ring = this.core.getChild("ring");
        this.bigHand = this.core.getChild("big_hand");
        this.smallHand = this.core.getChild("small_hand");
        this.leftLeg = root.getChild("left_leg");
        this.rightLeg = root.getChild("right_leg");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        // The body hangs from the origin, so a taller boss grows upward rather
        // than sinking its legs into the floor.
        ModelPartData core = root.addChild("core",
                ModelPartBuilder.create().uv(0, 0).cuboid(-9.0F, -18.0F, -6.0F, 18.0F, 18.0F, 12.0F),
                ModelTransform.origin(0.0F, -18.0F, 0.0F));

        core.addChild("crown",
                ModelPartBuilder.create().uv(0, 30).cuboid(-6.0F, -6.0F, -4.0F, 12.0F, 6.0F, 8.0F),
                ModelTransform.origin(0.0F, -18.0F, 0.0F));

        // A flat band standing proud of the body, so the silhouette has a
        // waist rather than being one slab.
        core.addChild("ring",
                ModelPartBuilder.create().uv(0, 44).cuboid(-11.0F, -2.0F, -8.0F, 22.0F, 4.0F, 16.0F),
                ModelTransform.origin(0.0F, -8.0F, 0.0F));

        // Both hands sit just off the front face and turn about its centre.
        core.addChild("big_hand",
                ModelPartBuilder.create().uv(48, 0).cuboid(-1.0F, -7.0F, 0.0F, 2.0F, 8.0F, 1.0F),
                ModelTransform.origin(0.0F, -9.0F, -6.5F));
        core.addChild("small_hand",
                ModelPartBuilder.create().uv(54, 0).cuboid(-1.0F, -4.0F, 0.0F, 2.0F, 5.0F, 1.0F),
                ModelTransform.origin(0.0F, -9.0F, -6.5F));

        root.addChild("left_leg",
                ModelPartBuilder.create().uv(40, 30).cuboid(-3.0F, 0.0F, -3.0F, 6.0F, 18.0F, 6.0F),
                ModelTransform.origin(5.0F, -18.0F, 0.0F));
        root.addChild("right_leg",
                ModelPartBuilder.create().uv(40, 30).cuboid(-3.0F, 0.0F, -3.0F, 6.0F, 18.0F, 6.0F),
                ModelTransform.origin(-5.0F, -18.0F, 0.0F));

        return TexturedModelData.of(data, 64, 64);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);

        // The hands never reset — a clock hand that snapped back to noon every
        // few seconds would look broken rather than mechanical.
        this.bigHand.roll = state.age * 0.12F;
        this.smallHand.roll = state.age * 0.02F;
        this.ring.yaw = state.age * 0.03F;
        this.crown.yaw = -state.age * 0.05F;

        // A slow sway on the core, and legs driven by the walk cycle.
        this.core.roll = (float) Math.cos(state.age * 0.05F) * 0.03F;
        float swing = state.limbSwingAnimationProgress;
        float amount = state.limbSwingAmplitude;
        this.leftLeg.pitch = (float) Math.cos(swing * 0.6F) * 0.9F * amount;
        this.rightLeg.pitch = (float) Math.cos(swing * 0.6F + Math.PI) * 0.9F * amount;
    }
}
