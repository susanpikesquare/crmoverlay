import { Connection } from 'jsforce';

declare global {
  namespace Express {
    interface Request {
      sfConnection?: Connection;
    }
  }
}
