-- Seed 12 starter tricks across three difficulty levels
-- 4 beginner (weight=1), 4 intermediate (weight=2), 4 advanced (weight=3)

INSERT INTO tricks (name, slug, difficulty, difficulty_weight, description) VALUES
-- Beginner tricks (1 point each)
(
  'Sit',
  'sit',
  'beginner',
  1,
  'Step 1: Hold a treat close to your dog''s nose.
Step 2: Move your hand up, allowing their head to follow and causing their bottom to lower.
Step 3: Once in sitting position, say "Sit" and give the treat.
Step 4: Practice daily, gradually reducing treat frequency.'
),
(
  'Stay',
  'stay',
  'beginner',
  1,
  'Step 1: Ask your dog to sit.
Step 2: Open your palm in front of you and say "Stay".
Step 3: Take a few steps back. If they stay, reward with treat.
Step 4: Gradually increase distance and duration before rewarding.'
),
(
  'Shake',
  'shake',
  'beginner',
  1,
  'Step 1: Hold a treat in your closed fist at chest level.
Step 2: Wait for your dog to paw at your hand.
Step 3: When they lift their paw, say "Shake" and open your hand.
Step 4: Reward and repeat until they offer paw on command.'
),
(
  'Lie Down',
  'lie-down',
  'beginner',
  1,
  'Step 1: Start with your dog in a sit position.
Step 2: Hold a treat in your fist and move it to the ground.
Step 3: Slide your hand along the ground to encourage lying down.
Step 4: Once lying down, say "Down" and give the treat.'
),
-- Intermediate tricks (2 points each)
(
  'Come',
  'come',
  'intermediate',
  2,
  'Step 1: Start in a distraction-free area with your dog on a leash.
Step 2: Squat down and say "Come" in an excited, happy voice.
Step 3: Gently pull the leash if needed, reward when they reach you.
Step 4: Practice in increasingly distracting environments.'
),
(
  'Heel',
  'heel',
  'intermediate',
  2,
  'Step 1: Start with your dog on your left side.
Step 2: Hold treats at your hip and start walking.
Step 3: Reward your dog for staying close to your side.
Step 4: Say "Heel" and practice in short sessions, gradually increasing duration.'
),
(
  'Roll Over',
  'roll-over',
  'intermediate',
  2,
  'Step 1: Start with your dog lying down.
Step 2: Hold a treat near their nose and move it toward their shoulder.
Step 3: As they roll onto their side, continue moving treat in a circle.
Step 4: Once they complete the roll, say "Roll Over" and reward.'
),
(
  'Play Dead',
  'play-dead',
  'intermediate',
  2,
  'Step 1: Ask your dog to lie down.
Step 2: Hold a treat and move it from their nose to their shoulder.
Step 3: As they roll onto their side, say "Bang" or "Play Dead".
Step 4: Reward and gradually increase how long they stay still.'
),
-- Advanced tricks (3 points each)
(
  'Spin',
  'spin',
  'advanced',
  3,
  'Step 1: Hold a treat near your dog''s nose.
Step 2: Move your hand in a circle, luring them to follow.
Step 3: Once they complete a full spin, say "Spin" and reward.
Step 4: Practice both directions and add hand signal.'
),
(
  'Fetch',
  'fetch',
  'advanced',
  3,
  'Step 1: Choose a toy your dog loves.
Step 2: Throw it a short distance and say "Fetch".
Step 3: When they pick it up, call them back with "Come".
Step 4: Trade the toy for a treat, then repeat. Gradually increase distance.'
),
(
  'Speak',
  'speak',
  'advanced',
  3,
  'Step 1: Wait for your dog to bark naturally.
Step 2: Immediately say "Speak" and reward them.
Step 3: After several repetitions, say "Speak" before they bark.
Step 4: Practice in various situations, pairing command with barking trigger.'
),
(
  'High Five',
  'high-five',
  'advanced',
  3,
  'Step 1: Start with your dog knowing "Shake".
Step 2: Hold your hand higher than usual.
Step 3: When they raise their paw to your raised hand, say "High Five".
Step 4: Reward contact with your palm. Practice raising hand gradually higher.'
);
