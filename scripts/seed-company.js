const { dataConnect } = require('../src/config/firebase');
const { COMPANY_INFO, DIVISIONS } = require('../src/knowledge/company');

(async () => {
  const { data } = await dataConnect.executeQuery('GetCompanyInfo');

  if (data.companies.length) console.log('skip company');
  else {
    await dataConnect.executeMutation('CreateCompany', COMPANY_INFO);
    console.log('created company');
  }

  const existing = new Map(data.divisions.map((d) => [d.name, d]));
  for (const d of DIVISIONS) {
    const found = existing.get(d.name);

    if (found) {
      if (d.email && d.email !== found.email) {
        await dataConnect.executeMutation('UpdateDivisionEmail', { id: found.id, email: d.email });
        console.log('updated email', d.name);
      } else console.log('skip', d.name);
      continue;
    }

    const vars = { name: d.name, description: d.description };
    if (d.email) vars.email = d.email;
    const res = await dataConnect.executeMutation('CreateDivision', vars);
    const divisionId = res.data.division_insert.id;
    for (const s of d.services) {
      await dataConnect.executeMutation('CreateService', { divisionId, ...s });
    }
    console.log('created', d.name);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });