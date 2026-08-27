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
 * A stone golem with a lit core in its chest.
 *
 * Squat rather than tall: a torso wider than it is high, on short legs, with
 * arms that hang past its knees. Those proportions are what read as stone —
 * the same volume drawn tall and narrow reads as a person in armour.
 *
 * The core pulses on its own clock rather than with the walk, so the thing
 * looks alive even standing still.
 */
public class GolemModel extends EntityModel<LivingEntityRenderState> {
    private final ModelPart torso;
    private final ModelPart head;
    private final ModelPart core;
    private final ModelPart leftArm;
    private final ModelPart rightArm;
    private final ModelPart leftLeg;
    private final ModelPart rightLeg;

    public GolemModel(ModelPart root) {
        super(root);
        this.torso = root.getChild("torso");
        this.head = this.torso.getChild("head");
        this.core = this.torso.getChild("core");
        this.leftArm = this.torso.getChild("left_arm");
        this.rightArm = this.torso.getChild("right_arm");
        this.leftLeg = root.getChild("left_leg");
        this.rightLeg = root.getChild("right_leg");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        ModelPartData torso = root.addChild("torso",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-15.0F, -30.0F, -11.0F, 30.0F, 30.0F, 22.0F),
                ModelTransform.origin(0.0F, -22.0F, 0.0F));

        torso.addChild("head",
                ModelPartBuilder.create().uv(106, 0)
                        .cuboid(-8.0F, -16.0F, -8.0F, 16.0F, 16.0F, 16.0F),
                ModelTransform.origin(0.0F, -30.0F, 0.0F));

        // Sits proud of the chest so the glow is not buried in the torso.
        torso.addChild("core",
                ModelPartBuilder.create().uv(172, 0)
                        .cuboid(-4.0F, -4.0F, -4.0F, 8.0F, 8.0F, 8.0F),
                ModelTransform.origin(0.0F, -17.0F, -11.0F));

        torso.addChild("left_arm",
                ModelPartBuilder.create().uv(206, 0)
                        .cuboid(-6.0F, -3.0F, -6.0F, 12.0F, 34.0F, 12.0F),
                ModelTransform.origin(20.0F, -26.0F, 0.0F));
        torso.addChild("right_arm",
                ModelPartBuilder.create().uv(0, 54)
                        .cuboid(-6.0F, -3.0F, -6.0F, 12.0F, 34.0F, 12.0F),
                ModelTransform.origin(-20.0F, -26.0F, 0.0F));

        root.addChild("left_leg",
                ModelPartBuilder.create().uv(50, 54)
                        .cuboid(-6.0F, 0.0F, -6.0F, 12.0F, 22.0F, 12.0F),
                ModelTransform.origin(7.0F, -22.0F, 0.0F));
        root.addChild("right_leg",
                ModelPartBuilder.create().uv(100, 54)
                        .cuboid(-6.0F, 0.0F, -6.0F, 12.0F, 22.0F, 12.0F),
                ModelTransform.origin(-7.0F, -22.0F, 0.0F));

        return TexturedModelData.of(data, 256, 160);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        float walk = state.limbSwingAnimationProgress * 0.55F;
        float amount = state.limbSwingAmplitude;
        this.leftLeg.pitch = (float) Math.cos(walk) * 0.55F * amount;
        this.rightLeg.pitch = (float) Math.cos(walk + Math.PI) * 0.55F * amount;
        // Arms swing far less than the legs. Long heavy arms that matched the
        // stride would look like it was jogging.
        this.leftArm.pitch = (float) Math.cos(walk + Math.PI) * 0.2F * amount;
        this.rightArm.pitch = (float) Math.cos(walk) * 0.2F * amount;
        this.leftArm.roll = 0.08F;
        this.rightArm.roll = -0.08F;
        this.head.yaw = state.relativeHeadYaw * 0.017453292F;
        this.head.pitch = state.pitch * 0.017453292F;
        // Its own slow clock, so it reads as alive when standing still.
        float pulse = 1.0F + (float) Math.sin(state.age * 0.08F) * 0.08F;
        this.core.xScale = pulse;
        this.core.yScale = pulse;
        this.core.zScale = pulse;
    }
}
