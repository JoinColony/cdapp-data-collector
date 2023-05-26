export const sortMetadataByTimestamp = (
  { transaction: { block: { timestamp: timestampA }}},
  { transaction: { block: { timestamp: timestampB }}},
) => parseInt(timestampB, 10) - parseInt(timestampA, 10);
