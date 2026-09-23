import { authenticate } from '../_shared/auth.ts';
import { json } from '../_shared/json.ts';
import { verify } from '../_shared/verify.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { ownerId, database } = await authenticate(request);
    const body = await request.json();
    const { workspaceId, operationId, fileId, versionId, kind, path, parentIds,
      deviceId, bucket, key, sha256, sizeBytes } = body;
    if (!['content', 'rename', 'tombstone', 'restore'].includes(kind)
      || !Array.isArray(parentIds) || parentIds.some((id) => typeof id !== 'string')) {
      return json({ error: 'Invalid publication request' }, 400);
    }
    if (kind === 'content' || kind === 'restore') {
      const { data, error } = await database.from('storage_uploads')
        .select('bucket,object_key,sha256,size_bytes')
        .eq('workspace_id', workspaceId).eq('owner_id', ownerId)
        .eq('operation_id', operationId).eq('version_id', versionId).single();
      if (error || !data || data.bucket !== bucket || data.object_key !== key
        || data.sha256 !== sha256 || data.size_bytes !== sizeBytes) {
        throw new Error('Upload reservation does not match publication');
      }
      await verify(bucket, key, sha256, sizeBytes);
      const confirmed = await database.rpc('storage_confirm_upload', {
        p_owner_id: ownerId, p_workspace_id: workspaceId, p_operation_id: operationId,
        p_version_id: versionId, p_sha256: sha256, p_size_bytes: sizeBytes,
      });
      if (confirmed.error) throw confirmed.error;
    }
    const { data, error } = await database.rpc('storage_publish_version', {
      p_owner_id: ownerId, p_workspace_id: workspaceId, p_operation_id: operationId,
      p_file_id: fileId, p_version_id: versionId, p_kind: kind, p_path: path ?? null,
      p_parent_ids: parentIds, p_device_id: deviceId, p_bucket: bucket ?? null,
      p_object_key: key ?? null, p_sha256: sha256 ?? null, p_size_bytes: sizeBytes ?? null,
    });
    if (error) throw error;
    return json(data);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Publication failed' }, 400);
  }
});
