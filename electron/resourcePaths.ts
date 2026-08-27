import fs from 'fs';
import path from 'path';

/**
 * Localiza um script auxiliar (ex.: .ps1) tanto em desenvolvimento quanto em
 * build empacotado pelo electron-builder.
 *
 * ATENÇÃO - lição aprendida: em build empacotado, tudo que está dentro de
 * "dist-electron"/"electron" fica compactado dentro do app.asar. O
 * fs.existsSync() enxerga esses caminhos normalmente porque o processo
 * Node/Electron tem um patch que lê o .asar como se fosse uma pasta comum.
 * Só que processos EXTERNOS do Windows (powershell.exe, cmd.exe) não têm
 * esse patch e não conseguem localizar nada dentro do .asar — a chamada
 * falha silenciosamente. Por isso todo script chamado via execFile deve
 * ser publicado via "extraResources" no electron-builder.json (ficando
 * fora do .asar, em resources/<arquivo>) e ser buscado aqui primeiro,
 * através de process.resourcesPath.
 */
export function resolverCaminhoScript(nomeArquivo: string): string | undefined {
  const candidatos = [
    // Produção (empacotado): resources/<arquivo> — fora do asar
    ...(process.resourcesPath ? [path.join(process.resourcesPath, nomeArquivo)] : []),
    // Dev / fallback
    path.join(__dirname, nomeArquivo),
    path.join(__dirname, '..', 'electron', nomeArquivo),
    path.join(process.cwd(), 'electron', nomeArquivo),
    path.join(process.cwd(), 'dist-electron', nomeArquivo),
  ];

  return candidatos.find((p) => fs.existsSync(p));
}
