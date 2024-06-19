
import * as path from 'path';

export const ServerDirectory = path.resolve(__dirname, "..");
export const ServerAssetsDirectory = path.join(ServerDirectory, "Assets");
export const AddonSkFilesDirectory = path.join(ServerAssetsDirectory, "Addons");
export const IsReleaseMode = ServerDirectory.includes('johnheikens.intelliskript');
export const ServerSrcDirectory = path.join(ServerDirectory, "src");
/**
 * capture groups:
 * [0]: returns "-" or ""
 * [1]: returns the whole numbers. for example '43'
 * [2]: returns the decimals. for example '29'
 * so "test -123.45" will return (index: 1, [0]: "-", [1]: "123", [2]: "45")
 */
export const NumberRegExp = /(?:(?<=(?: |^))(-){0,1})(\d+)(?:\.(\d+))?(?!\.)\b/;
export const BooleanRegExp = /(?<=( |^))true|false(?=( |$))/;
export const skriptFileHeader = "#AUTOMATICALLY GENERATED SKRIPT FILE\n#COPYRIGHT JOHN HEIKENS\n#https://github.com/JohnHeikens/IntelliSkript\n"