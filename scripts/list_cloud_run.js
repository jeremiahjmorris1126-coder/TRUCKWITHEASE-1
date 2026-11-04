const cp = require('child_process');

try {
  const jsonStr = cp.execSync('gcloud run services list --project=project-f0634118-be01-44f7-b36 --format=json').toString();
  const services = JSON.parse(jsonStr);

  console.log(`Found ${services.length} Cloud Run services in project-f0634118-be01-44f7-b36:\n`);

  for (const s of services) {
    const name = s.metadata.name;
    const region = s.metadata.labels['cloud.googleapis.com/location'] || s.metadata.annotations['run.googleapis.com/location'] || 'unknown';
    const ingress = s.metadata.annotations['run.googleapis.com/ingress'] || 'all';
    const url = s.status?.url || s.status?.address?.url || 'N/A';
    const lastDeploy = s.status?.conditions?.find(c => c.type === 'Ready')?.lastTransitionTime || s.metadata.creationTimestamp;
    const image = s.spec?.template?.spec?.containers?.[0]?.image || 'N/A';
    const creator = s.metadata.annotations['serving.knative.dev/creator'] || 'N/A';
    const lastModifier = s.metadata.annotations['serving.knative.dev/lastModifier'] || 'N/A';
    const sourceDeploy = s.metadata.annotations['run.googleapis.com/build-source-location'] || 'N/A';

    // Get IAM Policy for service
    let iamPolicy = 'Error fetching IAM';
    try {
      const iamStr = cp.execSync(`gcloud run services get-iam-policy ${name} --region=${region} --project=project-f0634118-be01-44f7-b36 --format=json`).toString();
      const iam = JSON.parse(iamStr);
      const bindings = iam.bindings || [];
      const invokers = bindings.filter(b => b.role === 'roles/run.invoker').map(b => b.members).flat();
      iamPolicy = invokers.length ? invokers.join(', ') : 'No roles/run.invoker bindings (Private/Restricted)';
    } catch (e) {
      iamPolicy = `Failed to get IAM: ${e.message}`;
    }

    console.log(`Service: ${name}`);
    console.log(`  Region:           ${region}`);
    console.log(`  URL:              ${url}`);
    console.log(`  Ingress:          ${ingress}`);
    console.log(`  Invoker IAM:      ${iamPolicy}`);
    console.log(`  Last Deployed:    ${lastDeploy}`);
    console.log(`  Container Image:  ${image}`);
    console.log(`  Source Location:  ${sourceDeploy}`);
    console.log(`  Created By:       ${creator}`);
    console.log(`  Last Modified By: ${lastModifier}`);
    console.log('------------------------------------------------------------');
  }
} catch (e) {
  console.error('Error:', e.message);
}

