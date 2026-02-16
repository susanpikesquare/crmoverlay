import { isAdmin } from '../adminAuth';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers/mocks';

describe('isAdmin middleware', () => {
  it('returns 401 when no session', () => {
    const req = createMockRequest({ session: undefined as any });
    const res = createMockResponse();
    const next = jest.fn();

    isAdmin(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when session has no userInfo', () => {
    const req = createMockRequest({ session: { userInfo: null } as any });
    const res = createMockResponse();
    const next = jest.fn();

    isAdmin(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', () => {
    const req = createMockRequest({
      session: { userInfo: { name: 'User' }, isAdmin: false, userRole: 'ae' } as any,
    });
    const res = createMockResponse();
    const next = jest.fn();

    isAdmin(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._json.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when isAdmin flag is true', () => {
    const req = createMockRequest({
      session: { userInfo: { name: 'Admin' }, isAdmin: true, userRole: 'ae' } as any,
    });
    const res = createMockResponse();
    const next = jest.fn();

    isAdmin(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when userRole is admin', () => {
    const req = createMockRequest({
      session: { userInfo: { name: 'Admin' }, isAdmin: false, userRole: 'admin' } as any,
    });
    const res = createMockResponse();
    const next = jest.fn();

    isAdmin(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
