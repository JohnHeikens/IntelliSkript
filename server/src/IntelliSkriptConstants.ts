import path from 'path';

export const intelliSkriptServerDirectory = path.resolve(__dirname, "..");
export const intelliSkriptServerAssetsDirectory = intelliSkriptServerDirectory + "\\Assets";
export const release = intelliSkriptServerDirectory.includes('johnheikens.intelliskript');
export const intelliSkriptServerSrcDirectory = intelliSkriptServerDirectory + "\\src";