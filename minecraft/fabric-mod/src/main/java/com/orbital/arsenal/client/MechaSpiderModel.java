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
 * Six legs and a lamp bar where a face should be.
 *
 * The legs are the point. Six of them on one sine wave looks like a toy; real
 * insects and every walking machine built since move them in two alternating
 * tripods, so at any moment three feet are down and three are swinging. That
 * costs one extra term and is the entire difference between a machine walking
 * and a machine wobbling.
 */
public class MechaSpiderModel extends EntityModel<LivingEntityRenderState> {
    private final ModelPart body;
    private final ModelPart head;
    private final ModelPart eyeBar;
    private final ModelPart[] legs = new ModelPart[6];

    private static final String[] LEG_NAMES =
            {"leg_a", "leg_b", "leg_c", "leg_d", "leg_e", "leg_f"};
    /** Where each leg attaches: three down each side, front to back. */
    private static final float[] LEG_X = {14.0F, 14.0F, 14.0F, -14.0F, -14.0F, -14.0F};
    private static final float[] LEG_Z = {-12.0F, 0.0F, 12.0F, -12.0F, 0.0F, 12.0F};
    /** The two tripods: legs 0, 3 and 5 lift while 1, 2 and 4 stay down. */
    private static final int[] TRIPOD = {0, 1, 1, 0, 1, 0};

    public MechaSpiderModel(ModelPart root) {
        super(root);
        this.body = root.getChild("body");
        this.head = this.body.getChild("head");
        this.eyeBar = this.head.getChild("eye_bar");
        for (int i = 0; i < 6; i++) {
            this.legs[i] = this.body.getChild(LEG_NAMES[i]);
        }
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        ModelPartData body = root.addChild("body",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-14.0F, -8.0F, -17.0F, 28.0F, 16.0F, 34.0F),
                ModelTransform.origin(0.0F, -26.0F, 0.0F));

        ModelPartData head = body.addChild("head",
                ModelPartBuilder.create().uv(126, 0)
                        .cuboid(-8.0F, -6.0F, -14.0F, 16.0F, 12.0F, 14.0F),
                ModelTransform.origin(0.0F, 0.0F, -17.0F));
        head.addChild("eye_bar",
                ModelPartBuilder.create().uv(188, 0)
                        .cuboid(-9.0F, -2.0F, -2.0F, 18.0F, 4.0F, 4.0F),
                ModelTransform.origin(0.0F, -2.0F, -14.0F));

        int[][] uv = {{0, 52}, {26, 52}, {52, 52}, {78, 52}, {104, 52}, {130, 52}};
        for (int i = 0; i < 6; i++) {
            body.addChild(LEG_NAMES[i],
                    ModelPartBuilder.create().uv(uv[i][0], uv[i][1])
                            .cuboid(-3.0F, 0.0F, -3.0F, 6.0F, 30.0F, 6.0F),
                    ModelTransform.origin(LEG_X[i], 6.0F, LEG_Z[i]));
        }

        return TexturedModelData.of(data, 256, 192);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        float walk = state.limbSwingAnimationProgress * 0.9F;
        float amount = Math.max(0.12F, state.limbSwingAmplitude);
        for (int i = 0; i < 6; i++) {
            // Half a cycle apart, so one tripod is always down.
            float phase = walk + (TRIPOD[i] == 0 ? 0.0F : (float) Math.PI);
            float swing = (float) Math.sin(phase) * 0.45F * amount;
            float lift = Math.max(0.0F, (float) Math.cos(phase)) * 0.35F * amount;
            this.legs[i].pitch = swing;
            // Legs on the right splay right, on the left splay left, and lift
            // by folding inward — a leg that lifted by rotating about its own
            // length would just spin.
            this.legs[i].roll = (LEG_X[i] > 0 ? 1 : -1) * (0.28F + lift);
        }
        this.head.yaw = state.relativeHeadYaw * 0.017453292F * 0.6F;
        this.body.pitch = (float) Math.sin(walk * 2.0F) * 0.02F * amount;
        this.eyeBar.roll = (float) Math.sin(state.age * 0.09F) * 0.05F;
    }
}
