'use client';
import type { AuroraAlertEvaluationResult } from '@aurorasense/coordinator';
export function AuroraEvidencePanel({result}:{result:AuroraAlertEvaluationResult}) {
  return <section className="location-card" aria-label="Local aurora evidence">
    <div className="eyebrow">LOCATION + TIME + SOURCE QUALITY</div>
    <h3 style={{color:result.alertColor}}>{result.title}</h3>
    <p>{result.summary}</p>
    <p className="fine">Deterministic evidence fusion · modelCalled: false · {result.algorithmVersion}. Numerical viewing probability is not calibrated.</p>
    <ul>{result.evidence.map(item=><li key={item}>{item}</li>)}</ul>
    <div className="table-scroll"><table><thead><tr><th>Evidence</th><th>Status</th><th>Measurement UTC</th></tr></thead><tbody>{result.sourceStatus.map(source=><tr key={source.source}><td>{source.sourceUrl?<a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.source}</a>:source.source}</td><td>{source.status}</td><td>{source.observedAtUtc??'Unknown'}</td></tr>)}</tbody></table></div>
    <p className="fine">{result.optimalViewingWindow}</p>
    <details><summary>Gaps and limitations</summary><ul>{result.limitations.map(item=><li key={item}>{item}</li>)}</ul></details>
  </section>;
}
