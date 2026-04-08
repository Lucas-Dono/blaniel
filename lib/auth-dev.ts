const DEV_USER_ID = 'dev_user_playground';

export function isDevMode(): boolean {
  return process.env.DEV_MODE === 'true';
}

export async function getDevUser() {
  if (!isDevMode()) return null;

  const { prisma } = await import('@/lib/prisma');

  let user = await prisma.user.findUnique({
    where: { id: DEV_USER_ID },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: DEV_USER_ID,
        email: 'dev@blaniel.local',
        name: 'Dev User',
        plan: 'ultra',
        emailVerified: true,
      },
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || 'Dev User',
    plan: (user as any).plan || 'free',
    image: user.image || null,
  };
}
