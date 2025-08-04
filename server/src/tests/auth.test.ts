
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type CreateUserInput } from '../schema';
import { login, createUser, getCurrentUser } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test inputs
const testUserInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  role: 'cashier'
};

const testLoginInput: LoginInput = {
  username: 'testuser',
  password: 'password'
};

describe('auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user', async () => {
      const result = await createUser(testUserInput);

      // Basic field validation
      expect(result.username).toEqual('testuser');
      expect(result.email).toEqual('test@example.com');
      expect(result.role).toEqual('cashier');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.password_hash).toEqual('hashed_password123');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      // Query database to verify user was saved
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].username).toEqual('testuser');
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].role).toEqual('cashier');
      expect(users[0].is_active).toBe(true);
      expect(users[0].password_hash).toEqual('hashed_password123');
    });

    it('should handle admin role', async () => {
      const adminInput: CreateUserInput = {
        ...testUserInput,
        username: 'admin',
        role: 'admin'
      };

      const result = await createUser(adminInput);

      expect(result.role).toEqual('admin');
      expect(result.username).toEqual('admin');
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // Create user first
      await createUser(testUserInput);

      const result = await login(testLoginInput);

      expect(result.user.username).toEqual('testuser');
      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.role).toEqual('cashier');
      expect(result.user.is_active).toBe(true);
      expect(result.token).toMatch(/^token_\d+_\d+$/);
    });

    it('should throw error for non-existent user', async () => {
      const invalidLogin: LoginInput = {
        username: 'nonexistent',
        password: 'password'
      };

      await expect(login(invalidLogin)).rejects.toThrow(/invalid credentials/i);
    });

    it('should throw error for wrong password', async () => {
      // Create user first
      await createUser(testUserInput);

      const wrongPasswordLogin: LoginInput = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      await expect(login(wrongPasswordLogin)).rejects.toThrow(/invalid credentials/i);
    });

    it('should throw error for inactive user', async () => {
      // Create user first
      const user = await createUser(testUserInput);

      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, user.id))
        .execute();

      await expect(login(testLoginInput)).rejects.toThrow(/account is inactive/i);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user by id', async () => {
      // Create user first
      const createdUser = await createUser(testUserInput);

      const result = await getCurrentUser(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdUser.id);
      expect(result!.username).toEqual('testuser');
      expect(result!.email).toEqual('test@example.com');
      expect(result!.role).toEqual('cashier');
      expect(result!.is_active).toBe(true);
    });

    it('should return null for non-existent user', async () => {
      const result = await getCurrentUser(999999);

      expect(result).toBeNull();
    });

    it('should return inactive user', async () => {
      // Create user first
      const createdUser = await createUser(testUserInput);

      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      const result = await getCurrentUser(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.is_active).toBe(false);
    });
  });
});
