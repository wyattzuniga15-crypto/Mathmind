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
 * A phoenix: a small body carrying a very large wingspan and a longer tail.
 *
 * The proportions are the whole trick. A bird drawn to scale is a chicken; a
 * bird whose wings are three times its body and whose tail is longer again
 * reads as something that belongs in the air.
 *
 * The wings beat on their own clock rather than on the walk cycle, since a
 * phoenix standing still should still look like it is about to leave.
 */
public class PhoenixModel extends EntityModel<LivingEntityRenderState> {
    private static final int FEATHERS = 3;

    private final ModelPart body;
    private final ModelPart head;
    private final ModelPart leftWing;
    private final ModelPart rightWing;
    private final ModelPart[] tail = new ModelPart[FEATHERS];
    private final ModelPart leftLeg;
    private final ModelPart rightLeg;

    public PhoenixModel(ModelPart root) {
        super(root);
        this.body = root.getChild("body");
        this.head = this.body.getChild("head");
        this.leftWing = this.body.getChild("left_wing");
        this.rightWing = this.body.getChild("right_wing");
        for (int i = 0; i < FEATHERS; i++) {
            this.tail[i] = this.body.getChild("tail_" + i);
        }
        this.leftLeg = this.body.getChild("left_leg");
        this.rightLeg = this.body.getChild("right_leg");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        ModelPartData body = root.addChild("body",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-5.0F, -5.0F, -10.0F, 10.0F, 10.0F, 20.0F),
                ModelTransform.origin(0.0F, -14.0F, 0.0F));

        ModelPartData head = body.addChild("head",
                ModelPartBuilder.create().uv(222, 0)
                        .cuboid(-4.0F, -8.0F, -8.0F, 8.0F, 8.0F, 8.0F),
                ModelTransform.origin(0.0F, -4.0F, -10.0F));
        head.addChild("beak",
                ModelPartBuilder.create().uv(168, 30)
                        .cuboid(-1.5F, -5.0F, -6.0F, 3.0F, 3.0F, 6.0F),
                ModelTransform.origin(0.0F, 0.0F, 0.0F));

        // Rooted at the shoulder and extending outward, so rolling the part
        // beats the wing instead of sliding it sideways.
        body.addChild("left_wing",
                ModelPartBuilder.create().uv(0, 30)
                        .cuboid(0.0F, -1.0F, -7.0F, 24.0F, 2.0F, 14.0F),
                ModelTransform.origin(5.0F, -3.0F, 0.0F));
        body.addChild("right_wing",
                ModelPartBuilder.create().uv(76, 30)
                        .cuboid(-24.0F, -1.0F, -7.0F, 24.0F, 2.0F, 14.0F),
                ModelTransform.origin(-5.0F, -3.0F, 0.0F));

        int[][] tailUv = {{60, 0}, {114, 0}, {168, 0}};
        for (int i = 0; i < FEATHERS; i++) {
            body.addChild("tail_" + i,
                    ModelPartBuilder.create().uv(tailUv[i][0], tailUv[i][1])
                            .cuboid(-1.5F, -1.0F, 0.0F, 3.0F, 2.0F, 24.0F),
                    ModelTransform.of(0.0F, -2.0F, 9.0F, 0.0F, (i - 1) * 0.28F, 0.0F));
        }

        body.addChild("left_leg",
                ModelPartBuilder.create().uv(152, 30)
                        .cuboid(-1.0F, 0.0F, -1.0F, 2.0F, 8.0F, 2.0F),
                ModelTransform.origin(3.0F, 5.0F, 2.0F));
        body.addChild("right_leg",
                ModelPartBuilder.create().uv(160, 30)
                        .cuboid(-1.0F, 0.0F, -1.0F, 2.0F, 8.0F, 2.0F),
                ModelTransform.origin(-3.0F, 5.0F, 2.0F));

        return TexturedModelData.of(data, 256, 64);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        float walk = state.limbSwingAnimationProgress * 0.6F;
        float amount = state.limbSwingAmplitude;
        float beat = state.age * 0.35F;

        // Down-beat further than the up-beat, which is what a real wing does
        // and what stops the flap looking like a hinge.
        float flap = (float) Math.sin(beat);
        float sweep = flap > 0 ? flap * 0.95F : flap * 0.45F;
        this.leftWing.roll = -sweep;
        this.rightWing.roll = sweep;
        this.leftWing.yaw = (float) Math.cos(beat) * 0.12F;
        this.rightWing.yaw = -this.leftWing.yaw;

        for (int i = 0; i < FEATHERS; i++) {
            this.tail[i].pitch = (float) Math.sin(beat * 0.5F + i) * 0.10F;
        }

        this.head.yaw = state.relativeHeadYaw * 0.017453292F;
        this.head.pitch = state.pitch * 0.017453292F;
        this.leftLeg.pitch = (float) Math.cos(walk) * 0.7F * amount;
        this.rightLeg.pitch = (float) Math.cos(walk + Math.PI) * 0.7F * amount;
        this.body.pitch = amount * 0.25F;
    }
}
