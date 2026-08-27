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
 * A dragon.
 *
 * The silhouette is doing all the work, and the silhouette is mostly wings: a
 * span of nearly six blocks against a body barely two. Draw a dragon with
 * wings proportional to its body and it reads as a lizard. Everything else —
 * neck, tail, the jaw hinged at the back rather than the front — exists to
 * make the head and tail read as continuations of one animal rather than
 * lumps stuck on either end.
 *
 * UV origins here are not chosen; they come from a packing pass that lays the
 * cuboids out first and checks nothing overlaps. Placed by eye, the Titan's
 * legs ended up four pixels inside each other.
 */
public class DragonModel extends EntityModel<LivingEntityRenderState> {
    private final ModelPart body;
    private final ModelPart neck;
    private final ModelPart head;
    private final ModelPart jaw;
    private final ModelPart tail;
    private final ModelPart tailTip;
    private final ModelPart leftWing;
    private final ModelPart rightWing;
    private final ModelPart leftLeg;
    private final ModelPart rightLeg;

    public DragonModel(ModelPart root) {
        super(root);
        this.body = root.getChild("body");
        this.neck = this.body.getChild("neck");
        this.head = this.neck.getChild("head");
        this.jaw = this.head.getChild("jaw");
        this.tail = this.body.getChild("tail");
        this.tailTip = this.tail.getChild("tail_tip");
        this.leftWing = this.body.getChild("left_wing");
        this.rightWing = this.body.getChild("right_wing");
        this.leftLeg = this.body.getChild("left_leg");
        this.rightLeg = this.body.getChild("right_leg");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();

        ModelPartData body = root.addChild("body",
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-17.0F, -11.0F, -11.0F, 34.0F, 22.0F, 22.0F),
                ModelTransform.origin(0.0F, -26.0F, 0.0F));

        ModelPartData neck = body.addChild("neck",
                ModelPartBuilder.create().uv(114, 0)
                        .cuboid(-6.0F, -6.0F, -18.0F, 12.0F, 12.0F, 12.0F),
                ModelTransform.origin(0.0F, -4.0F, -11.0F));

        ModelPartData head = neck.addChild("head",
                ModelPartBuilder.create().uv(164, 0)
                        .cuboid(-8.0F, -7.0F, -20.0F, 16.0F, 14.0F, 20.0F),
                ModelTransform.origin(0.0F, -2.0F, -18.0F));

        // Hinged at the back of the skull, so opening it swings the chin down
        // instead of sliding the whole jaw forward off the face.
        head.addChild("jaw",
                ModelPartBuilder.create().uv(0, 46)
                        .cuboid(-7.0F, 0.0F, -16.0F, 14.0F, 5.0F, 16.0F),
                ModelTransform.origin(0.0F, 5.0F, 0.0F));

        ModelPartData tail = body.addChild("tail",
                ModelPartBuilder.create().uv(62, 46)
                        .cuboid(-6.0F, -6.0F, 0.0F, 26.0F, 12.0F, 12.0F),
                ModelTransform.origin(0.0F, -2.0F, 11.0F));
        tail.addChild("tail_tip",
                ModelPartBuilder.create().uv(140, 46)
                        .cuboid(-3.0F, -3.0F, 0.0F, 20.0F, 6.0F, 6.0F),
                ModelTransform.origin(0.0F, 0.0F, 12.0F));

        // Nearly six blocks across the pair. This is the whole animal.
        body.addChild("left_wing",
                ModelPartBuilder.create().uv(0, 72)
                        .cuboid(0.0F, -1.0F, -15.0F, 46.0F, 3.0F, 30.0F),
                ModelTransform.origin(16.0F, -8.0F, 0.0F));
        body.addChild("right_wing",
                ModelPartBuilder.create().uv(0, 107)
                        .cuboid(-46.0F, -1.0F, -15.0F, 46.0F, 3.0F, 30.0F),
                ModelTransform.origin(-16.0F, -8.0F, 0.0F));

        body.addChild("left_leg",
                ModelPartBuilder.create().uv(154, 107)
                        .cuboid(-4.0F, 0.0F, -4.0F, 8.0F, 20.0F, 8.0F),
                ModelTransform.origin(10.0F, 10.0F, 2.0F));
        body.addChild("right_leg",
                ModelPartBuilder.create().uv(188, 107)
                        .cuboid(-4.0F, 0.0F, -4.0F, 8.0F, 20.0F, 8.0F),
                ModelTransform.origin(-10.0F, 10.0F, 2.0F));

        return TexturedModelData.of(data, 256, 256);
    }

    @Override
    public void setAngles(LivingEntityRenderState state) {
        super.setAngles(state);
        float beat = state.age * 0.14F;
        // Wings beat down hard and recover slowly. A symmetric sine reads as
        // flapping cardboard; weighting the downstroke is what makes it look
        // like the animal is pushing against something.
        float stroke = (float) Math.sin(beat);
        float power = stroke > 0 ? stroke : stroke * 0.45F;
        this.leftWing.roll = -power * 0.7F;
        this.rightWing.roll = power * 0.7F;
        // The body rises a little on the downstroke, a beat behind it.
        this.body.pitch = (float) Math.sin(beat - 0.8F) * 0.05F;
        // Neck and tail sway on the same travelling phase as the whale's, so
        // the whole animal moves as one thing rather than in parts.
        this.neck.yaw = (float) Math.sin(beat * 0.35F) * 0.12F;
        this.tail.yaw = (float) Math.sin(beat * 0.35F - 0.7F) * 0.22F;
        this.tailTip.yaw = (float) Math.sin(beat * 0.35F - 1.4F) * 0.3F;
        this.head.yaw = state.relativeHeadYaw * 0.017453292F * 0.5F;
        this.head.pitch = state.pitch * 0.017453292F * 0.5F;
        this.jaw.pitch = Math.max(0.0F, (float) Math.sin(beat * 0.2F)) * 0.3F;
        float walk = state.limbSwingAnimationProgress;
        float amount = state.limbSwingAmplitude;
        this.leftLeg.pitch = (float) Math.cos(walk * 0.6F) * 0.6F * amount;
        this.rightLeg.pitch = (float) Math.cos(walk * 0.6F + Math.PI) * 0.6F * amount;
    }
}
