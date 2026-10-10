const adminService = require('../services/admin.service');

exports.login = (req, res, next) => {
  try {
    res.json(adminService.login(req.body));
  } catch (e) { next(e); }
};

exports.me = (req, res) => res.json({ email: req.admin.email, role: req.admin.role });

exports.dashboard = async (req, res, next) => {
  try {
    res.json(await adminService.getDashboard());
  } catch (e) { next(e); }
};

exports.analyze = async (req, res, next) => {
  try {
    const analysis = await adminService.reanalyze(req.params.id);
    res.json({ id: req.params.id, analysis });
  } catch (e) { next(e); }
};
