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
 * A humanoid the size of a house.
 *
 * The proportion that sells scale is a small head, not a big body: a giant
 * built to human proportions just reads as a normal person seen close up.
 * This one is eight heads tall rather than the usual seven, with hands larger
 * than its head and a torso that is far deeper than it is wide.
 */
public class TitanModel extends EntityModel<LivingEntityRenderState> {
    private final ModelPart torso;
    private final ModelPart head;
    private final ModelPart leftArm;
    private final ModelPart rightArm;
    private final ModelPart leftLeg;
    private final ModelPart rightLeg;

    public TitanModel(ModelPart root) {
        super(root);
        this.torso = root.getChild("torso");
        this.head = this.torso.getChild("head");
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
                        .cuboid(-16.0F, -34.0F, -10.0F, 32.0F, 34.0F, 20.0F),
                ModelTransform.origin(0.0F, -40.0F, 0.0F));

        // Deliberately small. A head this size against that torso is what
        // makes the whole thing read as enormous rather than merely tall.
        torso.addChild("head",
                ModelPartBuilder.create().uv(106, 0)
                        .cuboid(-7.0F, -14.0F, -7.0F, 14.0F, 14.0F, 14.0F),
                ModelTransform.origin(0.0F, -34.0F, 0.0F));

        torso.addChild("left_arm",
                ModelPartBuilder.create().uv(164, 0)
                        .cuboid(-5.0F, -3.0F, -6.0F, 11.0F, 40.0F, 12.0F),
                ModelTransform.origin(21.0F, -31.0F, 0.0F));
        torso.addChild("right_arm",
                ModelPartBuilder.create().uv(0, 56)
                        .cuboid(-6.0F, -3.0F, -6.0F, 11.0F, 40.0F, 12.0F),
                ModelTransform.origin(-21.0F, -31.0F, 0.0F));

        root.addChild("left_leg",
                ModelPartBuilder.create().uv(48, 56)
                        .cuboid(-6.0F, 0.0F, -7.0F, 13.0F, 40.0F, 14.0F),
                ModelTransform.origin(8.0F, -40.0F, 0.0F));
        root.addChild("right_leg",
                ModelPartBuilder.create().uv(104, 56)
                        .cuboid(-7.0F, 0.0F, -7.0F, 13.0F, 40.0F, 14.0F),
                ModelTransform.origin(-8.0F, -40.0F, 0.0F));

        return TexturedModelData.of(data, 256, 128);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        // Half the usual swing rate. Something this size that moved at human
        // cadence would look like a scaled-up player rather than something
        // heavy — weight reads as slowness more than as size.
        // The same fields the Chronarch uses, which a real build has already
        // accepted — the render state's names have moved around between
        // versions and there is no reason to bet on a second set.
        float step = state.limbSwingAnimationProgress * 0.5F;
        float swing = state.limbSwingAmplitude;
        this.leftLeg.pitch = (float) Math.cos(step) * 0.7F * swing;
        this.rightLeg.pitch = (float) Math.cos(step + Math.PI) * 0.7F * swing;
        this.leftArm.pitch = (float) Math.cos(step + Math.PI) * 0.5F * swing;
        this.rightArm.pitch = (float) Math.cos(step) * 0.5F * swing;
        this.head.yaw = state.relativeHeadYaw * 0.017453292F;
        this.head.pitch = state.pitch * 0.017453292F;
        this.torso.pitch = (float) Math.sin(step * 0.5F) * 0.03F;
    }
}
