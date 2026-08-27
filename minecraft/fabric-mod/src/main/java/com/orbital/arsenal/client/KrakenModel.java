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
 * A kraken: one heavy mantle, a head under it, and eight arms.
 *
 * The arms are the whole silhouette, so they are built rather than drawn — a
 * ring of eight, each turned to face outward by its own yaw at build time, and
 * each with a second segment hanging off the first so it can curl rather than
 * swing as one stick.
 *
 * Every arm is given a different phase, because eight arms moving together
 * read as one arm drawn eight times.
 */
public class KrakenModel extends EntityModel<LivingEntityRenderState> {
    private static final int ARMS = 8;

    private final ModelPart mantle;
    private final ModelPart head;
    private final ModelPart[] arms = new ModelPart[ARMS];
    private final ModelPart[] tips = new ModelPart[ARMS];

    public KrakenModel(ModelPart root) {
        super(root);
        this.mantle = root.getChild("mantle");
        // The head hangs off the root, not off the mantle: the mantle pumps,
        // and a head parented to it would pump too, taking all eight arms with
        // it. Nothing about a kraken should breathe with its arms.
        this.head = root.getChild("head");
        for (int i = 0; i < ARMS; i++) {
            this.arms[i] = this.head.getChild("arm_" + i);
            this.tips[i] = this.arms[i].getChild("tip_" + i);
        }
    }

    /** Where arm i sits on the ring, in radians. */
    private static float angle(int i) {
        return (float) (i * Math.PI * 2.0 / ARMS);
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        // Laid out from the ground up: the tips of the arms have to end at
        // y = 0. The first version put them seventeen units below the feet,
        // which buries a third of the mob in the floor.
        root.addChild("mantle",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-11.0F, -30.0F, -11.0F, 22.0F, 30.0F, 22.0F),
                ModelTransform.origin(0.0F, -40.0F, 0.0F));

        ModelPartData head = root.addChild("head",
                ModelPartBuilder.create().uv(88, 0)
                        .cuboid(-10.0F, 0.0F, -10.0F, 20.0F, 12.0F, 20.0F),
                ModelTransform.origin(0.0F, -40.0F, 0.0F));

        head.addChild("eye_left",
                ModelPartBuilder.create().uv(144, 52)
                        .cuboid(-2.0F, 0.0F, -1.0F, 4.0F, 5.0F, 2.0F),
                ModelTransform.origin(6.0F, 3.0F, -10.0F));
        head.addChild("eye_right",
                ModelPartBuilder.create().uv(156, 52)
                        .cuboid(-2.0F, 0.0F, -1.0F, 4.0F, 5.0F, 2.0F),
                ModelTransform.origin(-6.0F, 3.0F, -10.0F));

        // The UVs come from a packing pass, not from eye: see make_mob_textures.
        int[][] armUv = {{168, 0}, {184, 0}, {200, 0}, {216, 0}, {232, 0},
                         {0, 52}, {16, 52}, {32, 52}};
        int[][] tipUv = {{48, 52}, {60, 52}, {72, 52}, {84, 52},
                         {96, 52}, {108, 52}, {120, 52}, {132, 52}};

        for (int i = 0; i < ARMS; i++) {
            float a = angle(i);
            ModelPartData arm = head.addChild("arm_" + i,
                    ModelPartBuilder.create().uv(armUv[i][0], armUv[i][1])
                            .cuboid(-2.0F, 0.0F, -2.0F, 4.0F, 16.0F, 4.0F),
                    ModelTransform.of((float) Math.sin(a) * 8.0F, 11.0F,
                            (float) Math.cos(a) * 8.0F, 0.0F, -a, 0.0F));
            arm.addChild("tip_" + i,
                    ModelPartBuilder.create().uv(tipUv[i][0], tipUv[i][1])
                            .cuboid(-1.5F, 0.0F, -1.5F, 3.0F, 14.0F, 3.0F),
                    ModelTransform.origin(0.0F, 15.0F, 0.0F));
        }

        return TexturedModelData.of(data, 256, 80);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        float walk = state.limbSwingAnimationProgress * 0.4F;
        float amount = state.limbSwingAmplitude;
        float clock = state.age * 0.06F;

        for (int i = 0; i < ARMS; i++) {
            // A phase per arm, plus the walk. Without the phase all eight move
            // as one and it reads as a skirt rather than as arms.
            float phase = clock + i * 0.8F;
            float curl = (float) Math.sin(phase) * 0.35F + amount * 0.3F;
            // Splayed outward by leaning away from the middle, and swept
            // backward a little as it moves.
            this.arms[i].pitch = 0.45F + curl;
            this.arms[i].roll = (float) Math.cos(phase) * 0.18F;
            this.tips[i].pitch = 0.5F + (float) Math.sin(phase + 1.2F) * 0.45F;
        }

        this.head.yaw = state.relativeHeadYaw * 0.017453292F * 0.5F;
        this.head.pitch = state.pitch * 0.017453292F * 0.5F;
        // The mantle pumps: it is how the thing moves, so it should not be still.
        float pump = 1.0F + (float) Math.sin(clock * 1.6F + walk) * 0.06F;
        this.mantle.xScale = pump;
        this.mantle.zScale = pump;
        this.mantle.yScale = 2.0F - pump;
    }
}
