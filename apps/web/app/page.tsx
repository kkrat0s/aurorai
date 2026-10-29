import Dashboard from '../components/dashboard';
import { loadCatalog, loadEvaluation } from '../lib/load-data';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const [catalog,evaluation] = await Promise.all([loadCatalog(),loadEvaluation()]);
  return <Dashboard initialCatalog={catalog} evaluation={evaluation} />;
}
