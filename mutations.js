// appsync, either local or remote

export const createToken = /* GraphQL */ `
  mutation CreateToken($input: CreateTokenInput!) {
    createToken(input: $input) {
      id
    }
  }
`;

export const createUniqueColony = /* GraphQL */ `
  mutation CreateUniqueColony($input: CreateUniqueColonyInput!) {
    createUniqueColony(input: $input) {
      id
    }
  }
`;

export const createColonyMetadata = /* GraphQL */ `
  mutation CreateColonyMetadata($input: CreateColonyMetadataInput!) {
    createColonyMetadata(input: $input) {
      id
    }
  }
`;

export const createColonyTokens = /* GraphQL */ `
  mutation CreateColonyTokens($input: CreateColonyTokensInput!) {
    createColonyTokens(input: $input) {
      id
    }
  }
`;

export const createDomainMetadata = /* GraphQL */ `
  mutation CreateDomainMetadata($input: CreateDomainMetadataInput!) {
    createDomainMetadata(input: $input) {
      id
    }
  }
`;

export const createDomain = /* GraphQL */ `
  mutation CreateDomain($input: CreateDomainInput!) {
    createDomain(input: $input) {
      id
    }
  }
`;

export const createUser = /* GraphQL */ `
  mutation CreateUniqueUser($input: CreateUniqueUserInput!) {
    createUniqueUser(input: $input) {
      id
    }
  }
`;

export const subscribeUserToColony = /* GraphQL */ `
  mutation SubscribeUserToColony($input: CreateWatchedColoniesInput!) {
    createWatchedColonies(input: $input) {
      id
    }
  }
`;

export const createExtension = /* GraphQL */ `
  mutation CreateExtension($input: CreateColonyExtensionInput!) {
    createColonyExtension(input: $input) {
      id
    }
  }
`;

export const updateExtension = /* GraphQL */ `
  mutation updateExtension($input: UpdateColonyExtensionInput!) {
    updateColonyExtension(input: $input) {
      id
    }
  }
`;

export const createRoleEntry = /* GraphQL */ `
  mutation CreateRoleEntry($input: CreateColonyRoleInput!) {
    createColonyRole(input: $input) {
      id
    }
  }
`;

export const createUserTokens = /* GraphQL */ `
  mutation CreateUserTokens($input: CreateUserTokensInput!) {
    createUserTokens(input: $input) {
      id
    }
}
`;
