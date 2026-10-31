import { ApiError, NetworkError } from '../api/errors';
import { uploadProof, type PhotoUploadDeps } from '../photoUpload';

jest.mock('../api/endpoints', () => ({ endpoints: {} }));

function deps(overrides: Partial<PhotoUploadDeps> = {}) {
  const presign = jest.fn(async () => ({
    url: 'https://r2.example/put',
    key: 'proof-30d/U1/K1.jpg',
    headers: { 'x-amz-meta': '1' },
    expiresAt: '2026-10-31T07:00:00Z',
  }));
  const put = jest.fn(async () => 200);
  const compress = jest.fn(async (uri: string) => ({ uri: `${uri}.small.jpg`, size: 120_000 }));
  return { compress, presign, put, ...overrides } as PhotoUploadDeps & {
    presign: jest.Mock;
    put: jest.Mock;
  };
}

describe('uploadProof', () => {
  it('compresses, presigns with the real size and uploads the small file', async () => {
    const d = deps();
    expect(await uploadProof('K1', 'file:///p.jpg', d)).toBe('proof-30d/U1/K1.jpg');
    expect(d.presign).toHaveBeenCalledWith('K1', 'image/jpeg', 120_000);
    expect(d.put).toHaveBeenCalledWith('file:///p.jpg.small.jpg', 'https://r2.example/put', {
      'x-amz-meta': '1',
    });
  });

  it('keeps the check-in without a photo when sharing is no longer allowed', async () => {
    const d = deps({
      presign: jest.fn(async () => {
        throw new ApiError(403, 'PLUS_REQUIRED', 'Plus');
      }),
    });
    expect(await uploadProof('K1', 'file:///p.jpg', d)).toBeNull();
    expect(d.put).not.toHaveBeenCalled();
  });

  it('skips a missing file and retries network trouble', async () => {
    expect(await uploadProof('K1', 'x', deps({ compress: async () => null }))).toBeNull();
    const offline = deps({
      presign: jest.fn(async () => {
        throw new NetworkError();
      }),
    });
    await expect(uploadProof('K1', 'x', offline)).rejects.toBeInstanceOf(NetworkError);
    await expect(uploadProof('K1', 'x', deps({ put: async () => 500 }))).rejects.toThrow(/500/);
  });
});
