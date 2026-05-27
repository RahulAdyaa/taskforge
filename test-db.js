const mongoose = require('mongoose');
require('dotenv').config({ path: './apps/api/.env' });
const { User, Project, ProjectMember, Task, AuditLog, Comment } = require('./apps/api/src/models');

async function testConnection() {
  console.log("Testing connection to:", process.env.MONGODB_URI.replace(/:([^:@]{8})[^:@]*@/, ':****@'));
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4 // Force IPv4
    });
    console.log("✅ Successfully connected to MongoDB!");

    const userId = '6a159a97bb6684b44d0bb8f0'; // User ID of Rahul adya from database

    // 1. Projects count
    const projectsCount = await ProjectMember.countDocuments({ userId });
    console.log("projectsCount:", projectsCount);

    // 2. Audit logs count
    const auditLogsCount = await AuditLog.countDocuments({ userId });
    console.log("auditLogsCount:", auditLogsCount);

    // 3. Comments count
    const commentsCount = await Comment.countDocuments({ userId });
    console.log("commentsCount:", commentsCount);

    // 4. API Calls estimate
    const user = await User.findById(userId);
    const loginCount = user.loginActivity?.length || 1;
    const apiCalls = (auditLogsCount * 12) + (commentsCount * 6) + (loginCount * 18) + 120;
    console.log("apiCalls:", apiCalls);

    // 5. AI Runs
    const aiRuns = user.promptHistory?.length || 0;
    console.log("aiRuns:", aiRuns);

    // 6. Storage footprint estimate
    const [memberRoles, userComments, userAuditLogs] = await Promise.all([
      ProjectMember.find({ userId }).populate('projectId'),
      Comment.find({ userId }),
      AuditLog.find({ userId })
    ]);
    const projectIds = memberRoles.map(m => m.projectId?._id);
    const userTasks = await Task.find({ projectId: { $in: projectIds } });

    const footprintData = {
      user: {
        name: user.name,
        email: user.email,
        username: user.username,
        techStack: user.techStack,
        skills: user.skills
      },
      projectsCount: memberRoles.length,
      tasksCount: userTasks.length,
      commentsCount: userComments.length,
      auditLogsCount: userAuditLogs.length
    };

    const sizeInBytes = Buffer.byteLength(JSON.stringify(footprintData));
    const storageKB = (sizeInBytes / 1024).toFixed(2);
    const storageStr = `${storageKB} KB`;
    console.log("storageStr:", storageStr);

    // 7. Monthly operational traffic
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await AuditLog.find({
      userId,
      createdAt: { $gte: thirtyDaysAgo }
    }).select('createdAt');

    const weeks = [0, 0, 0, 0];
    const now = new Date();

    recentLogs.forEach(log => {
      const diffTime = Math.abs(now - new Date(log.createdAt));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) weeks[3]++;
      else if (diffDays <= 14) weeks[2]++;
      else if (diffDays <= 21) weeks[1]++;
      else if (diffDays <= 30) weeks[0]++;
    });

    if (user.loginActivity) {
      user.loginActivity.forEach(log => {
        const logDate = new Date(log.timestamp);
        if (logDate >= thirtyDaysAgo) {
          const diffTime = Math.abs(now - logDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) weeks[3]++;
          else if (diffDays <= 14) weeks[2]++;
          else if (diffDays <= 21) weeks[1]++;
          else if (diffDays <= 30) weeks[0]++;
        }
      });
    }

    const trafficData = [
      { name: 'Week 1', traffic: weeks[0] + 12 },
      { name: 'Week 2', traffic: weeks[1] + 18 },
      { name: 'Week 3', traffic: weeks[2] + 15 },
      { name: 'Week 4', traffic: weeks[3] + 25 }
    ];
    console.log("trafficData:", trafficData);

    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

testConnection();
