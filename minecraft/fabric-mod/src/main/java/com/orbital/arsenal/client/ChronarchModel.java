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
    private final ModelPart leftShoulder;
    private final ModelPart rightShoulder;

    public ChronarchModel(ModelPart root) {
        super(root);
        this.core = root.getChild("core");
        this.crown = this.core.getChild("crown");
        this.ring = this.core.getChild("ring");
        this.bigHand = this.core.getChild("big_hand");
        this.smallHand = this.core.getChild("small_hand");
        this.leftLeg = root.getChild("left_leg");
        this.rightLeg = root.getChild("right_leg");
        this.leftShoulder = this.core.getChild("left_shoulder");
        this.rightShoulder = this.core.getChild("right_shoulder");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        // Everything hangs off the root at the feet, and negative y is up.
        // Sizes here are model units: sixteen to a block. The body is 26 wide
        // and 18 deep against 16-unit legs, which is what makes it read as
        // heavy — a tall thin box just reads as tall.
        ModelPartData core = root.addChild("core",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-13.0F, -26.0F, -9.0F, 26.0F, 26.0F, 18.0F),
                ModelTransform.origin(0.0F, -16.0F, 0.0F));

        // Sits directly on the body's top face. The first version put this
        // eighteen units above the body's own origin, which floated it two
        // blocks over the boss's head looking like a bug — because it was one.
        core.addChild("crown",
                ModelPartBuilder.create().uv(0, 77)
                        .cuboid(-8.0F, -8.0F, -6.0F, 16.0F, 8.0F, 12.0F),
                ModelTransform.origin(0.0F, -26.0F, 0.0F));

        // Wider and deeper than the body, so it overhangs on every side.
        core.addChild("ring",
                ModelPartBuilder.create().uv(0, 45)
                        .cuboid(-17.0F, -2.0F, -13.0F, 34.0F, 5.0F, 26.0F),
                ModelTransform.origin(0.0F, -9.0F, 0.0F));

        // Shoulders are pure bulk: they give it width at the top so the
        // silhouette is broad rather than a column.
        core.addChild("left_shoulder",
                ModelPartBuilder.create().uv(58, 77)
                        .cuboid(-5.0F, -6.0F, -9.0F, 10.0F, 12.0F, 18.0F),
                ModelTransform.origin(17.0F, -20.0F, 0.0F));
        core.addChild("right_shoulder",
                ModelPartBuilder.create().uv(58, 77)
                        .cuboid(-5.0F, -6.0F, -9.0F, 10.0F, 12.0F, 18.0F),
                ModelTransform.origin(-17.0F, -20.0F, 0.0F));

        // Both hands stand just clear of the front face and turn about the
        // middle of the dial.
        core.addChild("big_hand",
                ModelPartBuilder.create().uv(42, 98)
                        .cuboid(-1.0F, -10.0F, 0.0F, 2.0F, 11.0F, 1.0F),
                ModelTransform.origin(0.0F, -13.0F, -9.6F));
        core.addChild("small_hand",
                ModelPartBuilder.create().uv(50, 98)
                        .cuboid(-1.0F, -6.0F, 0.0F, 2.0F, 7.0F, 1.0F),
                ModelTransform.origin(0.0F, -13.0F, -9.6F));

        // Thick and short. Long legs would make it look like it could run.
        root.addChild("left_leg",
                ModelPartBuilder.create().uv(0, 98)
                        .cuboid(-5.0F, 0.0F, -5.0F, 10.0F, 16.0F, 10.0F),
                ModelTransform.origin(7.0F, -16.0F, 0.0F));
        root.addChild("right_leg",
                ModelPartBuilder.create().uv(0, 98)
                        .cuboid(-5.0F, 0.0F, -5.0F, 10.0F, 16.0F, 10.0F),
                ModelTransform.origin(-7.0F, -16.0F, 0.0F));

        // 128 square, because the body alone needs 88 by 44 of it.
        return TexturedModelData.of(data, 128, 128);
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
        // The shoulders breathe against the sway, so the mass looks carried
        // rather than welded on.
        this.leftShoulder.roll = (float) Math.cos(state.age * 0.05F) * 0.06F;
        this.rightShoulder.roll = -this.leftShoulder.roll;
        float swing = state.limbSwingAnimationProgress;
        float amount = state.limbSwingAmplitude;
        this.leftLeg.pitch = (float) Math.cos(swing * 0.6F) * 0.9F * amount;
        this.rightLeg.pitch = (float) Math.cos(swing * 0.6F + Math.PI) * 0.9F * amount;
    }
}
