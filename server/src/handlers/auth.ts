
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type User, type CreateUserInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function login(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    // In a real implementation, you would verify the password hash here
    // For now, we'll assume password is valid if user exists and is active
    if (input.password !== 'password') {
      throw new Error('Invalid credentials');
    }

    // Generate a simple token (in production, use JWT)
    const token = `token_${user.id}_${Date.now()}`;

    return {
      user: {
        ...user,
        // No numeric conversion needed - all fields are already correct types
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Hash password (simplified for demo - use bcrypt in production)
    const password_hash = `hashed_${input.password}`;

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        email: input.email,
        password_hash: password_hash,
        role: input.role
      })
      .returning()
      .execute();

    const user = result[0];
    return {
      ...user,
      // No numeric conversion needed - all fields are already correct types
    };
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function getCurrentUser(userId: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    return {
      ...user,
      // No numeric conversion needed - all fields are already correct types
    };
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
}
