import { describe, expect, it, vi } from 'vitest';
import { POST as metaPost } from '../app/api/meta/route';
import { GET as recordingGet, POST as recordingPost } from '../app/api/recordings/route';

describe('public endpoint boundaries', () => {
  it('cannot trigger a paid model call without authenticated agent controls', async () => {
    const network=vi.spyOn(globalThis,'fetch');
    try {
      const response=await metaPost(new Request('http://localhost/api/meta',{method:'POST',body:JSON.stringify({action:'spark_insight',payload:{}})}));
      expect(response.status).toBe(403);
      expect((await response.json()).modelCalled).toBe(false);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('does not list or accept private recordings on the public filesystem endpoint', async () => {
    for(const handler of [recordingGet,recordingPost]) {
      const response=await handler();
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe('PRIVATE_INGESTION_NOT_CONFIGURED');
    }
  });
  it('rejects malformed and oversized public evaluator requests', async () => {
    expect((await metaPost(new Request('http://localhost/api/meta',{method:'POST',body:'not JSON'}))).status).toBe(400);
    expect((await metaPost(new Request('http://localhost/api/meta',{method:'POST',body:'x'.repeat(20001)}))).status).toBe(413);
  });
});
