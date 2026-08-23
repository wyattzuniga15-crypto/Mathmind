package com.orbital.arsenal.weapons;

import java.util.ArrayList;
import java.util.List;

/** Concentric rings, shells shared out by circumference so spacing stays even. */
public final class Formation {
    public record Offset(double x, double z) {}

    private Formation() {}

    public static List<Offset> rings(int count, double radius, int rings) {
        List<Offset> points = new ArrayList<>(count);
        points.add(new Offset(0.0, 0.0));

        double[] radii = new double[rings];
        double totalWeight = 0.0;
        for (int ring = 1; ring <= rings; ring++) {
            radii[ring - 1] = (ring / (double) rings) * radius;
            totalWeight += radii[ring - 1];
        }

        int assigned = 0;
        double cumulative = 0.0;
        for (int i = 0; i < radii.length; i++) {
            cumulative += radii[i];
            // Round on the running total so the rings sum to exactly `count`.
            int target = (int) Math.round(((count - 1) * cumulative) / totalWeight);
            int share = target - assigned;
            assigned = target;
            // Twist each ring by a golden-ratio turn, or shells in neighbouring
            // rings line up and the circle reads as spokes rather than a disc.
            double twist = i * 0.6180339887 * Math.PI * 2.0;
            for (int s = 0; s < share; s++) {
                double angle = twist + (s / (double) share) * Math.PI * 2.0;
                points.add(new Offset(Math.cos(angle) * radii[i], Math.sin(angle) * radii[i]));
            }
        }
        return points;
    }
}
