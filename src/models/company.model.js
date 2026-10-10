const { dataConnect } = require('../config/firebase');

const findCompany = async () => {
  const res = await dataConnect.executeQuery('GetCompanyInfo');
  const [info] = res.data.companies;
  return info ? { ...info, divisions: res.data.divisions } : null;
};

module.exports = { findCompany }; 