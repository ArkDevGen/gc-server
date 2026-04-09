export enum UserRole {
  ADMIN = 'admin',
  OFFICE = 'office',
  STORE = 'store',
  FOREMAN = 'foreman',
}

export enum LocationType {
  WAREHOUSE = 'warehouse',
  STORE = 'store',
  BUILD_SITE = 'build_site',
}

export enum ItemType {
  INVENTORY = 'inventory',
  NON_INVENTORY = 'non_inventory',
  SERVICE = 'service',
  SURPLUS = 'surplus',
}

export enum UnitOfMeasure {
  EACH = 'each',
  FT = 'ft',
  LFT = 'lft',
  SQFT = 'sqft',
  CU_YD = 'cu_yd',
  TON = 'ton',
  LB = 'lb',
  GAL = 'gal',
  BAG = 'bag',
  BOX = 'box',
  PALLET = 'pallet',
  ROLL = 'roll',
  BUNDLE = 'bundle',
  OTHER = 'other',
}

export enum AdjustmentReason {
  PHYSICAL_COUNT = 'physical_count',
  DAMAGE = 'damage',
  THEFT = 'theft',
  CORRECTION = 'correction',
  RECEIVED = 'received',
  RETURNED = 'returned',
  BUILD_USAGE = 'build_usage',
  SALE = 'sale',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  SURPLUS_CAPTURE = 'surplus_capture',
  OTHER = 'other',
}
