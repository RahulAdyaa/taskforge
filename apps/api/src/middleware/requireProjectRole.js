const prisma = require('../lib/prisma');

const requireProjectRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id; // handle different param names
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const membership = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: req.user.id,
            projectId: projectId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({ error: 'Forbidden: You are not a member of this project' });
      }

      if (requiredRoles && !requiredRoles.includes(membership.role)) {
        return res.status(403).json({ error: `Forbidden: Requires one of roles: ${requiredRoles.join(', ')}` });
      }

      req.projectMembership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = requireProjectRole;
