-- ============================================================================
-- Promoção a administrador: só professor, nunca aluno
--
-- Até aqui, qualquer perfil podia virar admin. Na tela de alunos havia um
-- ícone de escudo em TODA linha, sem rótulo, e um toque nele dava a um aluno
-- acesso ao financeiro da academia, ao cadastro de todo mundo e à exclusão de
-- contas. A única trava que existia era a inversa (`prevent_last_admin_removal`,
-- que impede remover o último admin) — promover passava direto.
--
-- Decisão do dono da academia em 2026-09-22: administrador sai da equipe.
-- Aluno não muda de papel por esta via; para virar professor, a conta é
-- cadastrada como professor.
--
-- As transições permitidas passam a ser exatamente duas:
--
--     professor  ->  admin       (promover; a cor do professor é liberada)
--     admin      ->  professor   (rebaixar; a conta volta a precisar de cor)
--
-- A constraint `profiles_color_only_for_professor` continua cuidando da cor:
-- ela exige cor de professor e proíbe cor em qualquer outro papel. Por isso o
-- app precisa mandar `color` na mesma operação — promover sem limpar a cor
-- (ou rebaixar sem escolher uma) é recusado lá, com a mensagem dela.
-- ============================================================================

create or replace function public.enforce_role_change_rules()
returns trigger
language plpgsql
set search_path = ''
as $funcao$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Aluno é o papel de quem treina: não vira nada, e nada vira aluno. Uma
  -- conta cadastrada errada é excluída e refeita com o papel certo.
  if old.role = 'user' or new.role = 'user' then
    raise exception
      'Operação negada: a conta de aluno não muda de papel. Cadastre a pessoa como professor ou administrador.'
      using errcode = '42501';
  end if;

  return new;
end;
$funcao$;

comment on function public.enforce_role_change_rules() is
  'Só professor vira administrador (e volta a professor). Aluno não muda de papel — decisão de 2026-09-22.';

create trigger enforce_role_change_rules
  before update of role on public.profiles
  for each row execute function public.enforce_role_change_rules();
