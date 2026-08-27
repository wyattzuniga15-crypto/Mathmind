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
 * A whale, in the sky.
 *
 * The proportions are the whole trick: a body five blocks long against fins
 * barely a block thick, and a tail that is wide and flat rather than a stub.
 * Get those wrong and it reads as a fat fish. The head is not a separate lump
 * either — it is the front of the body, slightly narrower, which is why a
 * whale looks like one continuous thing and a fish does not.
 */
public class SkyWhaleModel extends EntityModel<LivingEntityRenderState> {
    private final ModelPart body;
    private final ModelPart tail;
    private final ModelPart fluke;
    private final ModelPart leftFin;
    private final ModelPart rightFin;
    private final ModelPart jaw;

    public SkyWhaleModel(ModelPart root) {
        super(root);
        this.body = root.getChild("body");
        this.tail = this.body.getChild("tail");
        this.fluke = this.tail.getChild("fluke");
        this.leftFin = this.body.getChild("left_fin");
        this.rightFin = this.body.getChild("right_fin");
        this.jaw = this.body.getChild("jaw");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        // Model units, sixteen to a block: 80 long, 34 tall, 30 deep is a
        // five-block animal. Everything else hangs off it.
        ModelPartData body = root.addChild("body",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-40.0F, -17.0F, -15.0F, 80.0F, 34.0F, 30.0F),
                ModelTransform.origin(0.0F, -20.0F, 0.0F));

        // The jaw is the front of the body, a touch narrower and hinged at the
        // back so it can open without the head coming apart.
        body.addChild("jaw",
                ModelPartBuilder.create().uv(0, 66)
                        .cuboid(-24.0F, -2.0F, -13.0F, 24.0F, 10.0F, 26.0F),
                ModelTransform.origin(-40.0F, 9.0F, 0.0F));

        // Tapers to the tail rather than stopping square.
        ModelPartData tail = body.addChild("tail",
                ModelPartBuilder.create().uv(0, 104)
                        .cuboid(0.0F, -9.0F, -7.0F, 26.0F, 18.0F, 14.0F),
                ModelTransform.origin(40.0F, 0.0F, 0.0F));

        // Wide and flat: a whale's fluke is horizontal, which is the single
        // detail that separates it from every fish.
        tail.addChild("fluke",
                ModelPartBuilder.create().uv(0, 138)
                        .cuboid(0.0F, -1.0F, -22.0F, 18.0F, 2.0F, 44.0F),
                ModelTransform.origin(26.0F, 0.0F, 0.0F));

        body.addChild("left_fin",
                ModelPartBuilder.create().uv(80, 138)
                        .cuboid(-8.0F, 0.0F, 0.0F, 22.0F, 3.0F, 12.0F),
                ModelTransform.origin(-8.0F, 8.0F, 15.0F));
        body.addChild("right_fin",
                ModelPartBuilder.create().uv(80, 156)
                        .cuboid(-8.0F, 0.0F, -12.0F, 22.0F, 3.0F, 12.0F),
                ModelTransform.origin(-8.0F, 8.0F, -15.0F));

        return TexturedModelData.of(data, 256, 192);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        float swim = state.age * 0.04F;
        // The whole body rolls, the tail lags behind it, and the fluke lags
        // behind the tail. Driving all three off the same phase makes it look
        // rigid; the offsets are what make the motion travel down the animal.
        this.body.pitch = (float) Math.sin(swim) * 0.06F;
        this.tail.yaw = (float) Math.sin(swim - 0.6F) * 0.28F;
        this.fluke.yaw = (float) Math.sin(swim - 1.2F) * 0.34F;
        this.leftFin.roll = (float) Math.sin(swim) * 0.22F;
        this.rightFin.roll = (float) -Math.sin(swim) * 0.22F;
        this.jaw.pitch = Math.max(0.0F, (float) Math.sin(swim * 0.3F)) * 0.24F;
    }
}
