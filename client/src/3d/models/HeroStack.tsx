import { Barbell } from './Barbell';
import { Dumbbell, DUMBBELL_REST_HEIGHT } from './Dumbbell';
import { Kettlebell } from './Kettlebell';
import { WeightPlate } from './WeightPlate';

/**
 * Hero still-life, authored in metres on a floor at y = 0:
 * a loaded Olympic barbell resting on its bumpers, a pair of hex dumbbells in the foreground,
 * a competition kettlebell and a plate leaning against the bar. Accent rings are used sparingly
 * (outer bumper faces only) so the configurable theme colour reads as a detail, not a light show.
 */
const PLATE_R = 0.225;

export function HeroStack() {
  return (
    <group>
      <Barbell
        position={[0, PLATE_R, 0]}
        plates={[
          { variant: 'bumper', accent: false },
          { variant: 'bumper', accent: true },
          { variant: 'steel', radius: 0.16, thickness: 0.032 },
        ]}
      />
      <Dumbbell position={[0.3, DUMBBELL_REST_HEIGHT, 0.42]} rotation={[0, 0.35, 0]} accent />
      <Dumbbell position={[0.05, DUMBBELL_REST_HEIGHT, 0.72]} rotation={[0, -0.2, 0]} />
      <Kettlebell position={[-0.32, 0, 0.5]} rotation={[0, 0.6, 0]} />
      {/* Bumper leaning against the bar behind it */}
      <WeightPlate position={[0.42, PLATE_R * 0.98, -0.12]} rotation={[-Math.PI / 2 + 0.2, 0, 0]} />
    </group>
  );
}
