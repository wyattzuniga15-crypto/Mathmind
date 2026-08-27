package com.orbital.arsenal.items;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/** Cycles the weather: clear, then rain, then a thunderstorm. */
public class WeatherControlItem extends Item {
    private static int mode = 0;
    private static final int COOLDOWN = 60;

    public WeatherControlItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        mode = (mode + 1) % 3;
        // setWeather takes four durations; naming them is the only way to be sure
        // which is which, since all four are plain ints.
        int clearFor = mode == 0 ? 12_000 : 0;
        int rainFor = mode == 0 ? 0 : 12_000;
        serverWorld.setWeather(clearFor, rainFor, mode != 0, mode == 2);
        String said = mode == 0 ? "§eClear skies." : mode == 1 ? "§7Rain." : "§8Thunderstorm.";
        user.sendMessage(Text.literal(said), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.WEATHER, 2.0F, mode == 2 ? 0.5F : 1.4F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
