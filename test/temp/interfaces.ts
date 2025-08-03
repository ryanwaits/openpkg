interface Address {
  street: string;
  city: string;
  country: string;
}

interface User {
  id: string;
  name: string;
  address: Address;
}

export type UserWithOptionalAddress = User & { address?: Address };
