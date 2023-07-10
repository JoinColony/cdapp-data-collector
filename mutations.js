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
