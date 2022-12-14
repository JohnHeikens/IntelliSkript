
import * as path from 'path';

export namespace IntelliSkriptConstants {
	export const ServerDirectory = path.resolve(__dirname, "..");
	export const ServerAssetsDirectory = path.join(ServerDirectory, "Assets");
	export const IsReleaseMode = ServerDirectory.includes('johnheikens.intelliskript');
	export const ServerSrcDirectory = path.join(ServerDirectory, "src");
	export const NumberRegExp = /((?<=( |^))-{0,1})(\d+)(\.\d+)?(?!\.)\b/;
	export const BooleanRegExp = /(?<=( |^))true|false(?=( |$))/
}